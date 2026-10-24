const { sequelize } = require('../config/database');
const { User } = require('../models');
const bcrypt = require('bcrypt');

async function testPitroPassword() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const email = 'pitro@gmail.com';
    const passwordToTest = '58276900Simon@'; // The password you're trying to use

    // Find the user
    const user = await User.findOne({ 
      where: { email } 
    });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('\n📋 User Info:');
    console.log('=============');
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Password Hash: ${user.password}`);

    // Test if the password matches
    const isValid = await bcrypt.compare(passwordToTest, user.password);
    console.log(`\n🔐 Testing password "${passwordToTest}": ${isValid ? '✅ MATCHES' : '❌ DOES NOT MATCH'}`);

    // If it doesn't match, let's try to find what password does match
    if (!isValid) {
      console.log('\n❌ The password you entered does not match the one in the database.');
      console.log('Options:');
      console.log('1. Try a different password');
      console.log('2. Reset the password using the reset script');
      
      // Show a few common password attempts (optional)
      const commonPasswords = ['password', '12345678', 'Admin@123', 'Pitro@123'];
      console.log('\nTesting common passwords (just for debugging):');
      for (const pwd of commonPasswords) {
        const testResult = await bcrypt.compare(pwd, user.password);
        console.log(`- "${pwd}": ${testResult ? '✅ MATCH' : '❌ No match'}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testPitroPassword();