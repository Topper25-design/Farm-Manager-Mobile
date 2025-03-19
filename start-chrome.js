const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Port for the app
const PORT = 3000;

// Function to check if port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => {
      resolve(true); // Port is in use
    });
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    server.listen(port);
  });
}

// Function to open URL in Chrome
function openChrome(url) {
  let command;
  switch (process.platform) {
    case 'win32':
      // Windows
      command = `start chrome "${url}"`;
      break;
    case 'darwin':
      // macOS
      command = `open -a "Google Chrome" "${url}"`;
      break;
    default:
      // Linux and others
      command = `google-chrome "${url}"`;
      break;
  }
  
  console.log(`Opening Chrome at ${url}`);
  exec(command, (error) => {
    if (error) {
      console.error('Error opening Chrome:', error);
    }
  });
}

async function startServer() {
  console.log('Starting Farm Manager Mobile app...');
  
  // Check if port is already in use
  const portInUse = await isPortInUse(PORT);
  
  if (portInUse) {
    console.log(`Port ${PORT} is already in use, opening browser directly`);
    openChrome(`http://localhost:${PORT}`);
    return;
  }
  
  // Start http-server
  const serverProcess = spawn('npx', [
    'http-server', 
    'www', 
    '-c-1',  // Disable caching
    `-p${PORT}`,  
    '--cors'
  ], { 
    stdio: 'inherit',
    shell: true
  });
  
  // Give the server a moment to start
  setTimeout(() => {
    openChrome(`http://localhost:${PORT}`);
  }, 1000);
  
  // Handle server termination
  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
  
  // Handle script termination
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    serverProcess.kill();
    process.exit(0);
  });
}

startServer(); 