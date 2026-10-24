const { sequelize } = require('../config/database');
const { User, Company } = require('../models');

async function verifyCompanyAdmin() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const email = 'pitro@gmail.com';

    // Direct database query to see raw data
    const [rawUser] = await sequelize.query(
      'SELECT id, email, company_id, role FROM users WHERE email = ?',
      {
        replacements: [email],
        type: sequelize.QueryTypes.SELECT
      }
    );

    console.log('\n📋 RAW DATABASE DATA:');
    console.log('=====================');
    console.log('Users table entry:');
    console.log(rawUser);

    // Get user with association
    const user = await User.findOne({
      where: { email },
      include: [{
        model: Company,
        as: 'userCompany'
      }]
    });

    if (!user) {
      console.log('\n❌ User not found in Sequelize');
      process.exit(1);
    }

    console.log('\n📋 SEQUELIZE DATA:');
    console.log('==================');
    console.log('User ID:', user.id);
    console.log('User Email:', user.email);
    console.log('User company_id:', user.company_id);
    console.log('User role:', user.role);
    
    if (user.userCompany) {
      console.log('\n✅ Company found:');
      console.log('Company ID:', user.userCompany.id);
      console.log('Company Name:', user.userCompany.name);
      console.log('Company Code:', user.userCompany.code);
      console.log('Company Status:', user.userCompany.status);
    } else {
      console.log('\n❌ No company associated');
      
      // Check if company exists separately
      if (user.company_id) {
        const company = await Company.findByPk(user.company_id);
        if (company) {
          console.log('\n✅ Company exists in database:');
          console.log('Company ID:', company.id);
          console.log('Company Name:', company.name);
          console.log('Company Code:', company.code);
        } else {
          console.log(`\n❌ Company with ID ${user.company_id} does not exist`);
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyCompanyAdmin();