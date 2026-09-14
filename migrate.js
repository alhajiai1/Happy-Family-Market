const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

function addColumn(name, definition) {
  return new Promise((resolve) => {
    db.run(`ALTER TABLE users ADD COLUMN ${name} ${definition}`, (err) => {
      if (err) {
        if (err.message.includes('duplicate column')) {
          console.log(`${name} already exists — skipping`);
        } else {
          console.error(`Error adding ${name}:`, err.message);
        }
      } else {
        console.log(`${name} added successfully`);
      }
      resolve();
    });
  });
}

async function migrate() {
  await addColumn('verification_code', 'TEXT');
  await addColumn('verification_code_expires', 'TEXT');
  await addColumn('is_verified', 'INTEGER DEFAULT 0');

  db.close(() => {
    console.log('Migration complete.');
  });
}

migrate();