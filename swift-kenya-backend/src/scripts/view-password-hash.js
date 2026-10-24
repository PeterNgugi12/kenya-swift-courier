const { sequelize } = require('../config/database');
const { User } = require('../models');

async function viewPasswordHash() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const email = 'pitro@gmail.com';

    const user = await User.findOne({ 
      where: { email },
      attributes: ['id', 'email', 'password', 'role', 'company_id']
    });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('\n📋 User Password Info:');
    console.log('=====================');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Company ID: ${user.company_id}`);
    console.log(`Password Hash: ${user.password}`);
    console.log(`Hash Length: ${user.password.length} characters`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

viewPasswordHash();