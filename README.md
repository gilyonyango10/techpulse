# TextPulse - Bulk SMS Application

TextPulse is a full-stack web application that enables secure user registration and login with JWT authentication, allowing authenticated users to send bulk SMS messages efficiently to multiple recipients.

## Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Bulk SMS Sending**: Send SMS to multiple recipients via manual entry or CSV upload
- **Message History**: View all sent messages with delivery status
- **Message Details**: Detailed view of each message with recipient-level status
- **Resend Failed Messages**: Retry sending to failed recipients
- **Dashboard**: Overview of recent messages and statistics
- **Responsive Design**: Modern UI built with React and Tailwind CSS

## Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Africa's Talking API** for SMS sending (with mock fallback)
- **express-validator** for input validation
- **helmet** for security headers
- **express-rate-limit** for rate limiting

### Frontend
- **React.js** with React Router v6
- **Tailwind CSS** for styling
- **Axios** for API calls
- **Context API** for state management

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd text-pulse
```

### 2. Backend Setup

#### Install Dependencies
```bash
npm install
```

#### Database Setup
1. Create a PostgreSQL database:
```sql
CREATE DATABASE textpulse;
```

2. Run the database schema:
```bash
psql -U your_username -d textpulse -f database/schema.sql
```

#### Environment Configuration
1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Update the `.env` file with your configuration:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=textpulse
DB_USER=your_db_username
DB_PASSWORD=your_db_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here

# Africa's Talking API Configuration
AFRICASTALKING_USERNAME=sandbox  # or your username
AFRICASTALKING_API_KEY=your_api_key_here

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 3. Frontend Setup

#### Navigate to Client Directory
```bash
cd client
```

#### Install Dependencies
```bash
npm install
```

## Running the Application

### 1. Start the Backend Server
From the root directory:
```bash
npm run dev
```
The backend will run on `http://localhost:5000`

### 2. Start the Frontend Development Server
In a new terminal, from the client directory:
```bash
cd client
npm start
```
The frontend will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile (protected)

### SMS Management
- `POST /api/sms/send` - Send bulk SMS (manual entry)
- `POST /api/sms/send-csv` - Send bulk SMS (CSV upload)
- `GET /api/sms/messages` - Get message history
- `GET /api/sms/messages/:messageId` - Get message details
- `POST /api/sms/messages/:messageId/resend` - Resend failed messages

## Usage

### 1. User Registration
- Navigate to `/register`
- Fill in your details (name, email, password)
- Click "Create Account"

### 2. User Login
- Navigate to `/login`
- Enter your email and password
- Click "Sign In"

### 3. Sending SMS
- Go to "Send SMS" from the dashboard or navigation
- Choose between manual entry or CSV upload
- Enter your message (160 character limit)
- Add recipients:
  - **Manual**: Enter phone numbers separated by commas
  - **CSV**: Upload a CSV file with phone numbers
- Click "Send SMS"

### 4. View Message History
- Go to "Messages" to see all sent messages
- Click "View Details" on any message for detailed information
- Use "Resend Failed" to retry sending to failed recipients

## CSV Format for Bulk SMS

Your CSV file should contain phone numbers in one of these column headers:
- `phone`
- `phoneNumber`
- `phone_number`
- `number`

Example CSV:
```csv
phone,name
+254712345678,John Doe
+254723456789,Jane Smith
+254734567890,Bob Johnson
```

## Africa's Talking API Setup

1. Sign up at [Africa's Talking](https://africastalking.com/)
2. Get your API key from the dashboard
3. For testing, use the sandbox environment
4. Update your `.env` file with the credentials

If no API key is configured, the system will use a mock service for testing.

## Security Features

- Password hashing with bcryptjs
- JWT token-based authentication
- Input validation and sanitization
- Rate limiting on API endpoints
- CORS configuration
- Security headers with helmet
- SQL injection prevention with parameterized queries

## Development Scripts

### Backend
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (if configured)

### Frontend
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## Database Schema

The application uses three main tables:

### Users Table
- `id` - Primary key
- `name` - User's full name
- `email` - User's email (unique)
- `password_hash` - Hashed password
- `created_at` - Registration timestamp
- `updated_at` - Last update timestamp

### Messages Table
- `id` - Primary key
- `user_id` - Foreign key to users table
- `message_content` - SMS message text
- `total_recipients` - Number of recipients
- `successful_sends` - Number of successful sends
- `failed_sends` - Number of failed sends
- `created_at` - Message creation timestamp
- `updated_at` - Last update timestamp

### Recipients Table
- `id` - Primary key
- `message_id` - Foreign key to messages table
- `phone_number` - Recipient's phone number
- `delivery_status` - Status (pending, sent, failed)
- `sent_at` - Delivery timestamp
- `error_message` - Error details if failed
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure PostgreSQL is running
   - Check database credentials in `.env`
   - Verify database exists and schema is loaded

2. **SMS Not Sending**
   - Check Africa's Talking API credentials
   - Verify phone number format (include country code)
   - Check API rate limits

3. **Frontend Not Loading**
   - Ensure backend is running on port 5000
   - Check proxy configuration in `client/package.json`
   - Clear browser cache and restart development server

4. **Authentication Issues**
   - Check JWT_SECRET in `.env`
   - Clear browser localStorage
   - Verify token expiration settings

### Logs
- Backend logs are displayed in the terminal
- Check browser console for frontend errors
- Database query logs can be enabled in development

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please create an issue in the repository or contact the development team.
