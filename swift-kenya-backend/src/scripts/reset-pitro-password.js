const { sequelize } = require('../config/database');
const { User } = require('../models');
const bcrypt = require('bcrypt');

async function resetPitroPassword() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const email = 'pitro@gmail.com';
    const newPassword = '58276900Simon@'; // Set this to the password you want to use

    // Find the user
    const user = await User.findOne({ 
      where: { email } 
    });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log(`Current role: ${user.role}`);
    console.log(`Current company_id: ${user.company_id}`);
    console.log(`Current password hash: ${user.password}`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update the user
    await user.update({ 
      password: hashedPassword,
      login_attempts: 0,
      lock_until: null,
      is_active: true
    });

    console.log('\n✅ Password reset successfully!');
    console.log('📋 New credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);

    // Verify the new password works
    const verifyUser = await User.findOne({ where: { email } });
    const verifyPassword = await bcrypt.compare(newPassword, verifyUser.password);
    console.log(`\n🔐 Verification: ${verifyPassword ? '✅ SUCCESS' : '❌ FAILED'}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetPitroPassword();