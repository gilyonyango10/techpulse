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

// Get all message templates for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT id, template_name, template_content, is_active, usage_count, created_at, updated_at
       FROM message_templates 
       WHERE user_id = $1 
       ORDER BY template_name ASC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    res.json({
      success: true,
      data: {
        templates: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: result.rows.length
        }
      }
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve message templates'
    });
  }
});

// Create a new message template
router.post('/',
  authenticateToken,
  [
    body('templateName')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Template name must be between 1 and 100 characters'),
    body('templateContent')
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage('Template content must be between 1 and 160 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { templateName, templateContent } = req.body;
      const userId = req.user.id;
      
      // Check if template name already exists for this user
      const existingTemplate = await pool.query(
        'SELECT id FROM message_templates WHERE user_id = $1 AND template_name = $2',
        [userId, templateName]
      );
      
      if (existingTemplate.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A template with this name already exists'
        });
      }
      
      const result = await pool.query(
        `INSERT INTO message_templates (user_id, template_name, template_content) 
         VALUES ($1, $2, $3) 
         RETURNING id, template_name, template_content, is_active, usage_count, created_at`,
        [userId, templateName, templateContent]
      );
      
      res.status(201).json({
        success: true,
        message: 'Message template created successfully',
        data: {
          template: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create message template'
      });
    }
  }
);

// Update a message template
router.put('/:templateId',
  authenticateToken,
  [
    body('templateName')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Template name must be between 1 and 100 characters'),
    body('templateContent')
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage('Template content must be between 1 and 160 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const { templateName, templateContent, isActive } = req.body;
      const userId = req.user.id;
      
      // Verify template belongs to user
      const templateCheck = await pool.query(
        'SELECT id FROM message_templates WHERE id = $1 AND user_id = $2',
        [templateId, userId]
      );
      
      if (templateCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Message template not found'
        });
      }
      
      const result = await pool.query(
        `UPDATE message_templates 
         SET template_name = $1, template_content = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5
         RETURNING id, template_name, template_content, is_active, usage_count, created_at, updated_at`,
        [templateName, templateContent, isActive !== undefined ? isActive : true, templateId, userId]
      );
      
      res.json({
        success: true,
        message: 'Message template updated successfully',
        data: {
          template: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update message template'
      });
    }
  }
);

// Delete a message template
router.delete('/:templateId', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query(
      'DELETE FROM message_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [templateId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message template not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Message template deleted successfully'
    });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message template'
    });
  }
});

// Use a template (increment usage count and return content)
router.post('/:templateId/use', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query(
      `UPDATE message_templates 
       SET usage_count = usage_count + 1 
       WHERE id = $1 AND user_id = $2 AND is_active = true
       RETURNING id, template_name, template_content, usage_count`,
      [templateId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message template not found or inactive'
      });
    }
    
    res.json({
      success: true,
      message: 'Template content retrieved',
      data: {
        template: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Use template error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to use message template'
    });
  }
});

// Get popular templates
router.get('/popular', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;
    
    const result = await pool.query(
      `SELECT id, template_name, template_content, usage_count, created_at
       FROM message_templates 
       WHERE user_id = $1 AND is_active = true
       ORDER BY usage_count DESC, created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    
    res.json({
      success: true,
      data: {
        templates: result.rows
      }
    });
  } catch (error) {
    console.error('Get popular templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve popular templates'
    });
  }
});

module.exports = router;