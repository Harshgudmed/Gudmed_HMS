import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

const RENDER_DB_URL = 'postgresql://gudmed_db_user:kMvSoIdDuYHhIUWgwDp6szWiJheMw68Q@dpg-d8emi4ek1jcs73a4sidg-a/gudmed_db'
const LOCAL_DB_URL = 'postgresql://postgres:password@localhost:5432/hospital_db'
const BACKUP_FILE = 'c:\\Users\\Dell\\Desktop\\migrations\\backup_gudmed.sql'

async function main() {
  try {
    console.log('🔄 Starting database restore process...\n')

    // Step 1: Backup from Render
    console.log('📦 Step 1: Backing up Render database...')
    const dumpCmd = `pg_dump "${RENDER_DB_URL}" > "${BACKUP_FILE}"`

    try {
      const { stdout, stderr } = await execAsync(dumpCmd, { shell: 'powershell' })
      console.log('✅ Backup completed!\n')
    } catch (err) {
      console.log('⚠️  pg_dump not found in PATH, trying alternative method...\n')

      // Alternative: use psql
      const psqlDump = `psql "${RENDER_DB_URL}" -c "\\\\dt" > "${BACKUP_FILE}"`
      try {
        await execAsync(psqlDump)
        console.log('✅ Using psql backup method\n')
      } catch (e) {
        console.log('❌ PostgreSQL tools not found')
        console.log('Solution: Install PostgreSQL from https://www.postgresql.org/download/windows/')
        console.log('Then add to PATH: C:\\Program Files\\PostgreSQL\\16\\bin\n')
        process.exit(1)
      }
    }

    // Step 2: Drop local database and recreate
    console.log('🗑️  Step 2: Dropping local database...')
    try {
      await execAsync(`psql "postgresql://postgres:password@localhost:5432" -c "DROP DATABASE IF EXISTS hospital_db"`)
      console.log('✅ Database dropped\n')
    } catch (err) {
      console.log('⚠️  Could not drop database')
    }

    // Step 3: Create new database
    console.log('🆕 Step 3: Creating new database...')
    try {
      await execAsync(`psql "postgresql://postgres:password@localhost:5432" -c "CREATE DATABASE hospital_db"`)
      console.log('✅ Database created\n')
    } catch (err) {
      console.log('⚠️  Database might already exist\n')
    }

    // Step 4: Restore backup
    console.log('📥 Step 4: Restoring data...')
    try {
      await execAsync(`psql "${LOCAL_DB_URL}" < "${BACKUP_FILE}"`)
      console.log('✅ Data restored!\n')
    } catch (err) {
      console.log(`⚠️  Error during restore: ${err.message}\n`)
    }

    console.log('🎉 Restore process completed!')
    console.log('📊 Your Render data is now in your local database!\n')

    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

main()
