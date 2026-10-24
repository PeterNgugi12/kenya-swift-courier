const { sequelize } = require('../config/database');
const { User } = require('../models');
const bcrypt = require('bcrypt');

async function debugPassword() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const email = 'pitro@gmail.com';
    const plainPassword = '58276900Simon@';

    // Step 1: Get the current user
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('\n📋 BEFORE RESET:');
    console.log('================');
    console.log(`Stored hash: ${user.password}`);

    // Step 2: Test if the stored hash matches the plain password
    const beforeCompare = await bcrypt.compare(plainPassword, user.password);
    console.log(`Does current hash match "${plainPassword}"? ${beforeCompare ? '✅ YES' : '❌ NO'}`);

    // Step 3: Manually hash the password
    console.log('\n🔧 Manually hashing password...');
    const saltRounds = 12;
    const manuallyHashed = await bcrypt.hash(plainPassword, saltRounds);
    console.log(`Manual hash: ${manuallyHashed}`);

    // Step 4: Test if the manual hash works
    const manualCompare = await bcrypt.compare(plainPassword, manuallyHashed);
    console.log(`Does manual hash work? ${manualCompare ? '✅ YES' : '❌ NO'}`);

    // Step 5: Update with manual hash
    console.log('\n📝 Updating with manual hash...');
    await user.update({ 
      password: manuallyHashed,
      login_attempts: 0,
      lock_until: null
    });

    // Step 6: Verify after update
    const updatedUser = await User.findOne({ where: { email } });
    console.log(`\n📋 AFTER RESET:`);
    console.log(`New stored hash: ${updatedUser.password}`);
    
    const afterCompare = await bcrypt.compare(plainPassword, updatedUser.password);
    console.log(`Does new hash match "${plainPassword}"? ${afterCompare ? '✅ YES' : '❌ NO'}`);

    // Step 7: Test with bcrypt compare directly
    const directCompare = await bcrypt.compare(plainPassword, updatedUser.password);
    console.log(`\n🔐 Final verification: ${directCompare ? '✅ SUCCESS' : '❌ FAILED'}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugPassword();