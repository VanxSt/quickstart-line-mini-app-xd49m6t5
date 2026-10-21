const fs = require('fs');

function fixEncoding(filePath) {
  const buf = fs.readFileSync(filePath);
  console.log(filePath, 'First 4 bytes:', buf[0], buf[1], buf[2], buf[3]);
  
  // Check UTF-16 LE BOM (FF FE) or null bytes
  let content = '';
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    console.log(filePath, 'detected UTF-16 LE BOM!');
    content = buf.toString('utf16le');
  } else if (buf.indexOf(0x00) !== -1) {
    console.log(filePath, 'contains null bytes! Decoding as UTF-16 LE...');
    content = buf.toString('utf16le');
  } else {
    console.log(filePath, 'is UTF-8 or ASCII');
    content = buf.toString('utf8');
  }
  
  // Write back as clean UTF-8 without BOM
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(filePath, 'saved as clean UTF-8. New size:', fs.statSync(filePath).size);
}

fixEncoding('admin.html');
fixEncoding('admin-gas.html');
