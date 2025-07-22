const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get SMS analytics dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query; // Days to look back
    
    // Get basic stats
    const totalMessagesResult = await pool.query(
      'SELECT COUNT(*) as total FROM messages WHERE user_id = $1',
      [userId]
    );
    
    const totalRecipientsResult = await pool.query(
      `SELECT SUM(total_recipients) as total 
       FROM messages 
       WHERE user_id = $1`,
      [userId]
    );
    
    const successfulSendsResult = await pool.query(
      `SELECT SUM(successful_sends) as total 
       FROM messages 
       WHERE user_id = $1`,
      [userId]
    );
    
    const failedSendsResult = await pool.query(
      `SELECT SUM(failed_sends) as total 
       FROM messages 
       WHERE user_id = $1`,
      [userId]
    );
    
    // Get recent activity (last 30 days by default)
    const recentActivityResult = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as messages_sent,
         SUM(total_recipients) as recipients_total,
         SUM(successful_sends) as successful_sends,
         SUM(failed_sends) as failed_sends,
         AVG(delivery_rate) as avg_delivery_rate
       FROM messages 
       WHERE user_id = $1 
         AND created_at >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [userId]
    );
    
    // Get top performing messages
    const topMessagesResult = await pool.query(
      `SELECT 
         id,
         message_content,
         total_recipients,
         successful_sends,
         delivery_rate,
         created_at
       FROM messages 
       WHERE user_id = $1 
         AND total_recipients > 0
       ORDER BY delivery_rate DESC, total_recipients DESC
       LIMIT 5`,
      [userId]
    );
    
    // Calculate overall delivery rate
    const totalRecipients = parseInt(totalRecipientsResult.rows[0].total) || 0;
    const totalSuccessful = parseInt(successfulSendsResult.rows[0].total) || 0;
    const overallDeliveryRate = totalRecipients > 0 ? (totalSuccessful / totalRecipients) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        summary: {
          totalMessages: parseInt(totalMessagesResult.rows[0].total),
          totalRecipients: totalRecipients,
          successfulSends: totalSuccessful,
          failedSends: parseInt(failedSendsResult.rows[0].total) || 0,
          overallDeliveryRate: Math.round(overallDeliveryRate * 100) / 100
        },
        recentActivity: recentActivityResult.rows,
        topMessages: topMessagesResult.rows,
        period: parseInt(period)
      }
    });
  } catch (error) {
    console.error('Get analytics dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics data'
    });
  }
});

// Get detailed message analytics
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      startDate, 
      endDate, 
      limit = 20, 
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    let query = `
      SELECT 
        m.id,
        m.message_content,
        m.total_recipients,
        m.successful_sends,
        m.failed_sends,
        m.delivery_rate,
        m.created_at,
        COUNT(r.id) as recipient_details_count
      FROM messages m
      LEFT JOIN recipients r ON m.id = r.message_id
      WHERE m.user_id = $1
    `;
    
    const params = [userId];
    let paramCount = 1;
    
    // Add date filters
    if (startDate) {
      query += ` AND m.created_at >= $${++paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND m.created_at <= $${++paramCount}`;
      params.push(endDate);
    }
    
    query += ` GROUP BY m.id, m.message_content, m.total_recipients, m.successful_sends, m.failed_sends, m.delivery_rate, m.created_at`;
    
    // Add sorting
    const allowedSortFields = ['created_at', 'total_recipients', 'delivery_rate', 'successful_sends'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY m.${sortField} ${order}`;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: {
        messages: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: result.rows.length
        }
      }
    });
  } catch (error) {
    console.error('Get message analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve message analytics'
    });
  }
});

// Get delivery status breakdown
router.get('/delivery-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.query;
    
    let query = `
      SELECT 
        r.delivery_status,
        COUNT(*) as count,
        ROUND((COUNT(*)::DECIMAL / SUM(COUNT(*)) OVER()) * 100, 2) as percentage
      FROM recipients r
      JOIN messages m ON r.message_id = m.id
      WHERE m.user_id = $1
    `;
    
    const params = [userId];
    let paramCount = 1;
    
    if (messageId) {
      query += ` AND m.id = $${++paramCount}`;
      params.push(messageId);
    }
    
    query += ` GROUP BY r.delivery_status ORDER BY count DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: {
        deliveryBreakdown: result.rows
      }
    });
  } catch (error) {
    console.error('Get delivery status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery status breakdown'
    });
  }
});

// Get cost analytics (if cost data is available)
router.get('/costs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query;
    
    // Daily cost breakdown
    const dailyCostsResult = await pool.query(
      `SELECT 
         DATE(r.created_at) as date,
         SUM(r.cost) as total_cost,
         COUNT(r.id) as total_messages
       FROM recipients r
       JOIN messages m ON r.message_id = m.id
       WHERE m.user_id = $1 
         AND r.cost IS NOT NULL
         AND r.created_at >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'
       GROUP BY DATE(r.created_at)
       ORDER BY date DESC`,
      [userId]
    );
    
    // Total cost summary
    const totalCostResult = await pool.query(
      `SELECT 
         SUM(r.cost) as total_cost,
         COUNT(r.id) as total_recipients,
         AVG(r.cost) as avg_cost_per_sms
       FROM recipients r
       JOIN messages m ON r.message_id = m.id
       WHERE m.user_id = $1 AND r.cost IS NOT NULL`,
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        dailyCosts: dailyCostsResult.rows,
        summary: totalCostResult.rows[0] || {
          total_cost: 0,
          total_recipients: 0,
          avg_cost_per_sms: 0
        },
        period: parseInt(period)
      }
    });
  } catch (error) {
    console.error('Get cost analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cost analytics'
    });
  }
});

// Get time-based analytics (best times to send)
router.get('/timing', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Hour of day analysis
    const hourlyResult = await pool.query(
      `SELECT 
         EXTRACT(HOUR FROM created_at) as hour,
         COUNT(*) as message_count,
         AVG(delivery_rate) as avg_delivery_rate
       FROM messages 
       WHERE user_id = $1 
         AND total_recipients > 0
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      [userId]
    );
    
    // Day of week analysis
    const weeklyResult = await pool.query(
      `SELECT 
         EXTRACT(DOW FROM created_at) as day_of_week,
         COUNT(*) as message_count,
         AVG(delivery_rate) as avg_delivery_rate
       FROM messages 
       WHERE user_id = $1 
         AND total_recipients > 0
       GROUP BY EXTRACT(DOW FROM created_at)
       ORDER BY day_of_week`,
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        hourlyStats: hourlyResult.rows.map(row => ({
          hour: parseInt(row.hour),
          messageCount: parseInt(row.message_count),
          avgDeliveryRate: parseFloat(row.avg_delivery_rate) || 0
        })),
        weeklyStats: weeklyResult.rows.map(row => ({
          dayOfWeek: parseInt(row.day_of_week),
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(row.day_of_week)],
          messageCount: parseInt(row.message_count),
          avgDeliveryRate: parseFloat(row.avg_delivery_rate) || 0
        }))
      }
    });
  } catch (error) {
    console.error('Get timing analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve timing analytics'
    });
  }
});

// Export analytics data
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, format = 'json' } = req.query;
    
    let query = `
      SELECT 
        m.id,
        m.message_content,
        m.total_recipients,
        m.successful_sends,
        m.failed_sends,
        m.delivery_rate,
        m.created_at,
        r.phone_number,
        r.delivery_status,
        r.error_message,
        r.sent_at,
        r.cost
      FROM messages m
      LEFT JOIN recipients r ON m.id = r.message_id
      WHERE m.user_id = $1
    `;
    
    const params = [userId];
    let paramCount = 1;
    
    if (startDate) {
      query += ` AND m.created_at >= $${++paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND m.created_at <= $${++paramCount}`;
      params.push(endDate);
    }
    
    query += ` ORDER BY m.created_at DESC, r.id ASC`;
    
    const result = await pool.query(query, params);
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'Message ID', 'Message Content', 'Total Recipients', 'Successful Sends', 
        'Failed Sends', 'Delivery Rate', 'Created At', 'Phone Number', 
        'Delivery Status', 'Error Message', 'Sent At', 'Cost'
      ];
      
      const csvRows = result.rows.map(row => [
        row.id,
        `"${row.message_content.replace(/"/g, '""')}"`,
        row.total_recipients,
        row.successful_sends,
        row.failed_sends,
        row.delivery_rate,
        row.created_at,
        row.phone_number || '',
        row.delivery_status || '',
        row.error_message ? `"${row.error_message.replace(/"/g, '""')}"` : '',
        row.sent_at || '',
        row.cost || ''
      ]);
      
      const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sms-analytics.csv"');
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: {
          analytics: result.rows,
          exportedAt: new Date().toISOString(),
          totalRecords: result.rows.length
        }
      });
    }
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export analytics data'
    });
  }
});

module.exports = router;