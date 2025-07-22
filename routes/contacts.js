const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// ===== CONTACT GROUPS =====

// Get all contact groups for a user
router.get('/groups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT id, group_name, description, contact_count, created_at, updated_at 
       FROM contact_groups 
       WHERE user_id = $1 
       ORDER BY group_name ASC`,
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        groups: result.rows
      }
    });
  } catch (error) {
    console.error('Get contact groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contact groups'
    });
  }
});

// Create a new contact group
router.post('/groups', 
  authenticateToken,
  [
    body('groupName')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Group name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { groupName, description } = req.body;
      const userId = req.user.id;
      
      // Check if group name already exists for this user
      const existingGroup = await pool.query(
        'SELECT id FROM contact_groups WHERE user_id = $1 AND group_name = $2',
        [userId, groupName]
      );
      
      if (existingGroup.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A group with this name already exists'
        });
      }
      
      const result = await pool.query(
        `INSERT INTO contact_groups (user_id, group_name, description) 
         VALUES ($1, $2, $3) 
         RETURNING id, group_name, description, contact_count, created_at`,
        [userId, groupName, description || null]
      );
      
      res.status(201).json({
        success: true,
        message: 'Contact group created successfully',
        data: {
          group: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Create contact group error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create contact group'
      });
    }
  }
);

// Update a contact group
router.put('/groups/:groupId',
  authenticateToken,
  [
    body('groupName')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Group name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const { groupName, description } = req.body;
      const userId = req.user.id;
      
      // Verify group belongs to user
      const groupCheck = await pool.query(
        'SELECT id FROM contact_groups WHERE id = $1 AND user_id = $2',
        [groupId, userId]
      );
      
      if (groupCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Contact group not found'
        });
      }
      
      const result = await pool.query(
        `UPDATE contact_groups 
         SET group_name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4
         RETURNING id, group_name, description, contact_count, created_at, updated_at`,
        [groupName, description || null, groupId, userId]
      );
      
      res.json({
        success: true,
        message: 'Contact group updated successfully',
        data: {
          group: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Update contact group error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update contact group'
      });
    }
  }
);

// Delete a contact group
router.delete('/groups/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    // Check if group has contacts
    const contactCount = await pool.query(
      'SELECT COUNT(*) as count FROM contacts WHERE group_id = $1',
      [groupId]
    );
    
    if (parseInt(contactCount.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete group that contains contacts. Move or delete contacts first.'
      });
    }
    
    const result = await pool.query(
      'DELETE FROM contact_groups WHERE id = $1 AND user_id = $2 RETURNING id',
      [groupId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact group not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Contact group deleted successfully'
    });
  } catch (error) {
    console.error('Delete contact group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact group'
    });
  }
});

// ===== CONTACTS =====

// Get all contacts for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId, search, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT c.id, c.full_name, c.phone_number, c.email, c.is_active, 
             c.created_at, cg.group_name
      FROM contacts c
      LEFT JOIN contact_groups cg ON c.group_id = cg.id
      WHERE c.user_id = $1
    `;
    const params = [userId];
    let paramCount = 1;
    
    // Add filters
    if (groupId) {
      query += ` AND c.group_id = $${++paramCount}`;
      params.push(groupId);
    }
    
    if (search) {
      query += ` AND (c.full_name ILIKE $${++paramCount} OR c.phone_number ILIKE $${++paramCount})`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY c.full_name ASC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: {
        contacts: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: result.rows.length
        }
      }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contacts'
    });
  }
});

// Add a new contact
router.post('/',
  authenticateToken,
  [
    body('phoneNumber')
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be between 1 and 255 characters'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email address'),
    body('groupId')
      .optional()
      .isInt()
      .withMessage('Group ID must be a valid integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { phoneNumber, fullName, email, groupId } = req.body;
      const userId = req.user.id;
      
      // Check if contact already exists
      const existingContact = await pool.query(
        'SELECT id FROM contacts WHERE user_id = $1 AND phone_number = $2',
        [userId, phoneNumber]
      );
      
      if (existingContact.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A contact with this phone number already exists'
        });
      }
      
      // Verify group belongs to user if provided
      if (groupId) {
        const groupCheck = await pool.query(
          'SELECT id FROM contact_groups WHERE id = $1 AND user_id = $2',
          [groupId, userId]
        );
        
        if (groupCheck.rows.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid group ID'
          });
        }
      }
      
      const result = await pool.query(
        `INSERT INTO contacts (user_id, group_id, full_name, phone_number, email) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, full_name, phone_number, email, is_active, created_at`,
        [userId, groupId || null, fullName || null, phoneNumber, email || null]
      );
      
      res.status(201).json({
        success: true,
        message: 'Contact added successfully',
        data: {
          contact: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Add contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add contact'
      });
    }
  }
);

// Update a contact
router.put('/:contactId',
  authenticateToken,
  [
    body('phoneNumber')
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be between 1 and 255 characters'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email address'),
    body('groupId')
      .optional()
      .isInt()
      .withMessage('Group ID must be a valid integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { contactId } = req.params;
      const { phoneNumber, fullName, email, groupId } = req.body;
      const userId = req.user.id;
      
      // Verify contact belongs to user
      const contactCheck = await pool.query(
        'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
        [contactId, userId]
      );
      
      if (contactCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }
      
      const result = await pool.query(
        `UPDATE contacts 
         SET full_name = $1, phone_number = $2, email = $3, group_id = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 AND user_id = $6
         RETURNING id, full_name, phone_number, email, is_active, created_at, updated_at`,
        [fullName || null, phoneNumber, email || null, groupId || null, contactId, userId]
      );
      
      res.json({
        success: true,
        message: 'Contact updated successfully',
        data: {
          contact: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Update contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update contact'
      });
    }
  }
);

// Delete a contact
router.delete('/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id',
      [contactId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact'
    });
  }
});

// Get contacts from a specific group for SMS sending
router.get('/groups/:groupId/numbers', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    // Verify group belongs to user
    const groupCheck = await pool.query(
      'SELECT id, group_name FROM contact_groups WHERE id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact group not found'
      });
    }
    
    const contacts = await pool.query(
      'SELECT phone_number, full_name FROM contacts WHERE group_id = $1 AND is_active = TRUE',
      [groupId]
    );
    
    res.json({
      success: true,
      data: {
        groupName: groupCheck.rows[0].group_name,
        phoneNumbers: contacts.rows.map(c => c.phone_number),
        contacts: contacts.rows
      }
    });
  } catch (error) {
    console.error('Get group numbers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve group contacts'
    });
  }
});

module.exports = router;