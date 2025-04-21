const { exec } = require('child_process');
const { join } = require('path');
const http = require('http');
const httpServer = require('http-server');

// Start HTTP server for www directory
const server = httpServer.createServer({
  root: join(__dirname, 'www'),
  cache: -1,
  cors: true
});

// Start server on port 3000
server.listen(3000);
console.log('Server running at http://localhost:3000/');

// Function to open Chrome with the URL
function openChrome() {
  const url = 'http://localhost:3000/';

  // Command to open Chrome with our URL
  // This works for Windows - adjust path if Chrome is installed in a different location
  const chromeCommand = `start chrome --new-window "${url}"`;

  exec(chromeCommand, (error) => {
    if (error) {
      console.error('Failed to open Chrome:', error);
      console.log('Please open this URL manually in your browser:', url);
    } else {
      console.log('Chrome opened with URL:', url);
    }
  });
}

// Check if server is ready before opening Chrome
setTimeout(openChrome, 1000); // Give server a moment to start

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
      console.log('Server closed.');
      process.exit(0);
  });
}); 