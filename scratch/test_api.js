const http = require('http');

http.get('http://localhost:3000/auth/users/2', (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
