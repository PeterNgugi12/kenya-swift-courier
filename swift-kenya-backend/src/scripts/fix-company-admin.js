const { sequelize } = require('../config/database');
const { User, Company } = require('../models');

async function fixCompanyAdmin() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Find Chania Sacco company
    const company = await Company.findOne({
      where: { code: 'CSM' } // Chania Sacco code
    });

    if (!company) {
      console.log('❌ Company with code CSM not found');
      
      // List all companies
      const allCompanies = await Company.findAll({
        attributes: ['id', 'name', 'code']
      });
      
      console.log('\n📋 Available companies:');
      allCompanies.forEach(c => {
        console.log(`- ${c.name} (${c.code}) - ID: ${c.id}`);
      });
      
      process.exit(1);
    }

    console.log('✅ Found company:');
    console.log(`ID: ${company.id}`);
    console.log(`Name: ${company.name}`);
    console.log(`Code: ${company.code}`);

    // Find the user
    const user = await User.findOne({
      where: { email: 'pitro@gmail.com' }
    });

    if (!user) {
      console.log('❌ User pitro@gmail.com not found');
      
      // List all users
      const allUsers = await User.findAll({
        attributes: ['id', 'email', 'role', 'company_id'],
        limit: 10
      });
      
      console.log('\n📋 Recent users:');
      allUsers.forEach(u => {
        console.log(`- ${u.email} (Role: ${u.role}, Company ID: ${u.company_id})`);
      });
      
      process.exit(1);
    }

    console.log('\n✅ User found:');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Current Role: ${user.role}`);
    console.log(`Current Company ID: ${user.company_id || 'NOT SET'}`);

    // Update the user with company_id
    user.company_id = company.id;
    user.role = 'COMPANY_ADMIN'; // Ensure correct role
    await user.save();

    console.log('\n✅ User updated successfully:');
    console.log(`New Company ID: ${user.company_id}`);
    console.log(`Role: ${user.role}`);

    // Verify the update
    const updatedUser = await User.findOne({
      where: { email: 'pitro@gmail.com' },
      include: [{
        model: Company,
        as: 'userCompany',
        attributes: ['id', 'name', 'code']
      }]
    });

    console.log('\n📋 Verification:');
    console.log(`User: ${updatedUser.email}`);
    console.log(`Company: ${updatedUser.userCompany?.name} (${updatedUser.userCompany?.code})`);
    console.log(`Status: ${updatedUser.userCompany ? '✅ Linked' : '❌ Not linked'}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCompanyAdmin();