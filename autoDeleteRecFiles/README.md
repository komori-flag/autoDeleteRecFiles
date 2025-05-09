# Auto Delete Recording Files 🗑️🎥

A Node.js script to automatically delete old recording files from surveillance systems while maintaining a minimum number of files and sending email notifications.

## ✨ Key Features
- Automatically deletes oldest files when storage limit is reached
- Maintains minimum number of files as backup
- Configurable file patterns and directories
- Email notifications for deletion events
- Detailed logging of all operations

## 🛠️ Installation
1. Clone the repository:
```bash
git clone https://github.com/komori-flag/autoDeleteRecFiles.git
cd autoDeleteRecFiles
```

2. Install required packages:
```bash
npm i 
```

## 🚀 Usage
Run the script with:
```bash
node index.js
```

## ⚙️ Configuration
Edit `config.js` with your settings:
```javascript
module.exports = {
  // Scheduled task configuration (cron expression)
  cronSchedule: '0 */6 * * *',
  
  // Disk space configuration
  minFreeSpaceGB: 50, // Minimum free space threshold (GB)
  bufferPercentage: 10, // Buffer space percentage
  
  // Monitoring file path configuration
  recordingsPath: 'E:/Recordings',
  
  // Delete Operation Configuration
  // Delay time from warning to execution of deletion (hours)
  deleteDelay: 24,
  
  // Email Notification Configuration
  email: {
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'notifications@example.com',
        pass: 'your-password'
      }
    },
    from: 'notifications@example.com',
    to: ['admin@example.com', 'manager@example.com']
  }
};

```

## 📧 Email Notifications
The script will send email notifications when:
- Files are deleted due to storage limits
- Errors occur during the deletion process
- The script completes successfully

## ⚠️ Important Notes
- Deleted files cannot be recovered - use with caution!
- Always test with a small directory first
- Ensure proper backups exist before running

## ❓ Support
For issues or questions, please open an issue on GitHub.
