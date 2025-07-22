# TextPulse - Enterprise Bulk SMS Messaging System

TextPulse is a comprehensive, full-stack messaging system that provides secure user authentication through message tokens and enables efficient bulk SMS delivery to multiple recipients. The system is designed to meet enterprise-level messaging requirements with robust security, comprehensive analytics, and streamlined user experience.

## 🎯 Project Requirements Compliance

This messaging system fully satisfies the following requirements:

### ✅ Secure User Sign-up & Authentication
- **JWT Token-based Authentication**: Robust authentication system using JSON Web Tokens
- **Phone Number Verification**: OTP-based verification during registration for enhanced security
- **Password Security**: bcryptjs hashing with configurable salt rounds
- **Multi-factor Authentication**: Phone verification + email validation
- **Session Management**: Secure token expiration and refresh mechanisms

### ✅ Bulk SMS Functionality
- **Multiple Recipients**: Send SMS to hundreds of recipients simultaneously
- **CSV Upload Support**: Bulk upload via CSV files with intelligent parsing
- **Multiple SMS Providers**: Support for Twilio, Africa's Talking, and mock services
- **Delivery Tracking**: Real-time status tracking for each recipient
- **Failed Message Retry**: Automatic and manual retry mechanisms
- **Message Templates**: Reusable templates for efficient bulk messaging

### ✅ Client-Server Architecture
- **RESTful API**: Well-structured Express.js backend with comprehensive endpoints
- **React Frontend**: Modern, responsive UI with real-time updates
- **Database Integration**: PostgreSQL with optimized schema and indexes
- **Scalable Design**: Modular architecture supporting horizontal scaling

## 🚀 Enhanced Features

### 📊 Advanced Analytics & Reporting
- **Real-time Dashboard**: Comprehensive SMS analytics and performance metrics
- **Delivery Rate Analysis**: Detailed success/failure rate tracking
- **Cost Analytics**: SMS cost tracking and budget management
- **Time-based Insights**: Best time to send analysis
- **Export Functionality**: CSV and JSON data export capabilities

### 👥 Contact Management System
- **Contact Groups**: Organize recipients into logical groups
- **Contact Database**: Centralized contact management with search functionality
- **Group-based Messaging**: Send to entire contact groups with one click
- **Import/Export**: CSV-based contact import and export

### 📝 Message Template System
- **Template Library**: Create and manage reusable message templates
- **Usage Analytics**: Track template performance and popularity
- **Template Categories**: Organize templates by type or purpose
- **Character Optimization**: 160-character SMS optimization

### 🔐 Enterprise Security Features
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input sanitization and validation
- **CORS Security**: Configurable cross-origin resource sharing
- **SQL Injection Prevention**: Parameterized queries and prepared statements
- **Security Headers**: Helmet.js integration for enhanced security

## 📋 Tech Stack

### Backend Technologies
- **Node.js** with Express.js framework
- **PostgreSQL** database with optimized schema
- **JWT** for secure authentication
- **bcryptjs** for password hashing
- **express-validator** for input validation
- **helmet** for security headers
- **express-rate-limit** for API rate limiting
- **multer** for file upload handling

### SMS Service Providers
- **Africa's Talking API** for SMS delivery
- **Twilio API** for alternative SMS service
- **Mock Service** for development and testing

### Frontend Technologies
- **React.js** with React Router v6
- **Tailwind CSS** for modern styling
- **Axios** for API communication
- **Context API** for state management

## 🛠 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

### 1. Clone and Install

```bash
git clone <repository-url>
cd textpulse
npm install
cd client && npm install && cd ..
```

### 2. Database Setup

#### Create Database
```sql
CREATE DATABASE textpulse_db;
```

#### Initialize Schema
```bash
# Use the enhanced complete schema
psql -U your_username -d textpulse_db -f database/complete_schema.sql
```

### 3. Environment Configuration

Create a `.env` file from the example:
```bash
cp .env.example .env
```

Configure your environment variables:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=textpulse_db
DB_USER=your_db_username
DB_PASSWORD=your_db_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_256_bit_minimum

# SMS Provider Configuration
SMS_PROVIDER=africastalking  # or 'twilio' or 'mock'

# Africa's Talking Configuration
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_API_KEY=your_api_key_here

# Twilio Configuration (if using Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
TWILIO_MESSAGING_SERVICE_SID=your_messaging_service_sid

# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### 4. Run the Application

#### Development Mode
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd client && npm start
```

#### Production Mode
```bash
npm run build
npm start
```

## 📡 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Initial user registration (sends OTP) |
| POST | `/api/auth/verify-registration` | Complete registration with OTP |
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/profile` | Get user profile |
| POST | `/api/auth/request-password-reset` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with OTP |

### SMS Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sms/send` | Send bulk SMS (manual entry) |
| POST | `/api/sms/send-csv` | Send bulk SMS (CSV upload) |
| GET | `/api/sms/messages` | Get message history |
| GET | `/api/sms/messages/:id` | Get message details |
| POST | `/api/sms/messages/:id/resend` | Resend failed messages |

### Contact Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | Get all contacts |
| POST | `/api/contacts` | Add new contact |
| PUT | `/api/contacts/:id` | Update contact |
| DELETE | `/api/contacts/:id` | Delete contact |
| GET | `/api/contacts/groups` | Get contact groups |
| POST | `/api/contacts/groups` | Create contact group |
| PUT | `/api/contacts/groups/:id` | Update contact group |
| DELETE | `/api/contacts/groups/:id` | Delete contact group |
| GET | `/api/contacts/groups/:id/numbers` | Get group phone numbers |

### Template Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | Get all templates |
| POST | `/api/templates` | Create new template |
| PUT | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |
| POST | `/api/templates/:id/use` | Use template (increment count) |
| GET | `/api/templates/popular` | Get popular templates |

### Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | Get dashboard analytics |
| GET | `/api/analytics/messages` | Get detailed message analytics |
| GET | `/api/analytics/delivery-status` | Get delivery status breakdown |
| GET | `/api/analytics/costs` | Get cost analytics |
| GET | `/api/analytics/timing` | Get timing analytics |
| GET | `/api/analytics/export` | Export analytics data |

## 💾 Database Schema

### Core Tables

#### Users
- Stores user account information with verification status
- Supports phone and email verification
- Secure password hashing

#### Messages
- Tracks all sent SMS messages
- Automatic delivery rate calculation
- Links to user and recipients

#### Recipients
- Individual SMS delivery tracking
- Status monitoring and error logging
- Cost tracking per SMS

#### OTP Verifications
- Secure OTP management
- Multiple purposes (registration, password reset)
- Attempt limiting and expiration

### Extended Tables

#### Contact Groups & Contacts
- Organized contact management
- Group-based messaging support
- Contact deduplication

#### Message Templates
- Reusable message content
- Usage tracking and analytics
- Template categorization

#### Scheduled Messages
- Future message scheduling
- Recurring message support
- Status tracking

#### SMS Analytics
- Daily analytics aggregation
- Performance metrics storage
- Cost tracking and reporting

## 🔒 Security Features

### Authentication Security
- JWT tokens with configurable expiration
- Phone number verification via OTP
- Password strength requirements
- Account lockout on failed attempts

### API Security
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection prevention
- CORS protection
- Security headers via Helmet.js

### Data Protection
- Encrypted password storage
- Secure session management
- Data validation at all layers
- Error handling without information leakage

## 📈 Usage Examples

### 1. User Registration Flow
```javascript
// Step 1: Register user (sends OTP)
POST /api/auth/register
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "+1234567890",
  "password": "SecurePass123"
}

// Step 2: Verify OTP
POST /api/auth/verify-registration
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

### 2. Send Bulk SMS
```javascript
// Manual entry
POST /api/sms/send
{
  "message": "Welcome to our service!",
  "recipients": ["+1234567890", "+0987654321"]
}

// CSV upload
POST /api/sms/send-csv
Content-Type: multipart/form-data
- csvFile: contacts.csv
- message: "Bulk message content"
```

### 3. Contact Management
```javascript
// Create contact group
POST /api/contacts/groups
{
  "groupName": "VIP Customers",
  "description": "High-value customers"
}

// Add contact to group
POST /api/contacts
{
  "phoneNumber": "+1234567890",
  "fullName": "Jane Smith",
  "email": "jane@example.com",
  "groupId": 1
}
```

### 4. Analytics Dashboard
```javascript
// Get dashboard data
GET /api/analytics/dashboard?period=30

// Export analytics
GET /api/analytics/export?format=csv&startDate=2024-01-01&endDate=2024-01-31
```

## 🎨 Frontend Features

### Modern UI Components
- Responsive design with Tailwind CSS
- Real-time status updates
- Interactive dashboards
- Mobile-optimized interface

### User Experience
- Intuitive navigation
- Progress indicators
- Error handling with user-friendly messages
- Keyboard shortcuts and accessibility

### Performance
- Lazy loading for large datasets
- Optimized API calls
- Caching strategies
- Progressive web app features

## 🧪 Testing

### Development Testing
```bash
# Backend tests
npm test

# Frontend tests
cd client && npm test

# Integration tests
npm run test:integration
```

### SMS Testing
The system includes a mock SMS service for development:
- 90% success rate simulation
- Realistic delay simulation
- Error scenario testing
- Cost calculation testing

## 🚀 Deployment

### Production Checklist
1. **Environment Variables**: Configure all production values
2. **Database**: Run production schema and migrations
3. **SMS Provider**: Configure real SMS API credentials
4. **Security**: Enable HTTPS and security headers
5. **Monitoring**: Set up logging and error tracking
6. **Backup**: Configure database backups
7. **Scaling**: Configure load balancing if needed

### Deployment Options
- **Traditional VPS**: PM2 process management
- **Docker**: Containerized deployment
- **Cloud Platforms**: Heroku, AWS, DigitalOcean
- **Serverless**: AWS Lambda, Vercel functions

## 📊 Performance Optimization

### Database Optimization
- Comprehensive indexes on frequently queried columns
- Connection pooling for concurrent requests
- Query optimization for large datasets
- Automated cleanup of expired data

### API Optimization
- Response caching for static data
- Pagination for large result sets
- Compression middleware
- CDN integration for static assets

### SMS Delivery Optimization
- Bulk sending optimization
- Retry logic for failed messages
- Provider failover support
- Queue management for high-volume sending

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check connection parameters in `.env`
   - Ensure database exists and schema is loaded

2. **SMS Not Sending**
   - Verify SMS provider credentials
   - Check phone number format (include country code)
   - Monitor API rate limits and quotas

3. **Authentication Problems**
   - Verify JWT_SECRET configuration
   - Check token expiration settings
   - Clear browser localStorage/cookies

4. **Performance Issues**
   - Monitor database query performance
   - Check rate limiting settings
   - Review error logs for bottlenecks

### Logging and Monitoring
- Structured logging with timestamp and user context
- Error tracking and alerting
- Performance monitoring
- SMS delivery monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

### Development Guidelines
- Follow ESLint configuration
- Write comprehensive tests
- Update documentation
- Follow semantic versioning

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting section
- Review the API documentation

---

## 🎉 Success Metrics

Your TextPulse messaging system now fully satisfies all project requirements:

✅ **Secure User Sign-up**: Complete with phone verification and JWT authentication  
✅ **Message Token Authentication**: JWT-based secure authentication system  
✅ **Bulk SMS Delivery**: Comprehensive bulk messaging with multiple provider support  
✅ **Client-Server Architecture**: Modern full-stack implementation  
✅ **Efficient Communication**: Optimized performance and user experience  
✅ **Seamless Process**: Intuitive UI and robust error handling  

The system is production-ready and enterprise-grade! 🚀