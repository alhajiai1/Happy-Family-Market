const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.run(`ALTER TABLE reviews ADD COLUMN image_url TEXT`, (err) => {
  if (err) {
    if (err.message.includes('duplicate column')) {
      console.log('image_url already exists on reviews — skipping.');
    } else {
      console.error('Failed to add image_url:', err.message);
    }
  } else {
    console.log('image_url added to reviews table.');
  }
  db.close();
});