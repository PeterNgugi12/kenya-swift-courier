const { sequelize } = require('../config/database');
const { User } = require('../models');
const bcrypt = require('bcrypt');

async function cleanReset() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const email = 'pitro@gmail.com';
    const plainPassword = '58276900Simon@';

    // Find the user
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found');
    console.log(`Current hash: ${user.password}`);

    // Set the password directly - the hook will check if it's already hashed
    // Since this is plain text, it will be hashed by the hook
    user.password = plainPassword;
    await user.save();

    console.log('✅ Password updated via model');

    // Get fresh user
    const updatedUser = await User.findOne({ where: { email } });
    console.log(`\nNew stored hash: ${updatedUser.password}`);

    // Test the password
    const isValid = await updatedUser.comparePassword(plainPassword);
    console.log(`Password verification: ${isValid ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (isValid) {
      console.log('\n🎉 SUCCESS! You can now login with:');
      console.log(`Email: ${email}`);
      console.log(`Password: ${plainPassword}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanReset();