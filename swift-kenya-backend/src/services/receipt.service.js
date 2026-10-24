// services/receipt.service.js
const { Branch, Company, User } = require('../models');

class ReceiptService {
  // Generate receipt for new parcel booking
  generateReceipt(parcel, user, company, originBranch, destBranch) {
    console.log("🧾 Generating booking receipt for parcel:", parcel.tracking_number);
    
    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Generate receipt number
    const receiptNumber = `RCP-${parcel.tracking_number}-${Date.now().toString().slice(-6)}`;

    const receipt = {
      receipt_number: receiptNumber,
      tracking_number: parcel.tracking_number,
      generated_at: `${formattedDate} ${formattedTime}`,
      receipt_type: 'BOOKING',
      
      // Company Information
      company: {
        name: company?.name || 'Company Name',
        code: company?.code || 'N/A',
        logo: company?.logo_url || null,
        contact: {
          phone: company?.phone || 'N/A',
          email: company?.email || 'N/A',
          website: company?.website || 'N/A'
        }
      },

      // Branch Information
      origin_branch: {
        name: originBranch?.name || 'N/A',
        code: originBranch?.code || 'N/A',
        town: originBranch?.town || 'N/A',
        address: originBranch?.address || 'N/A'
      },

      // Staff Information
      served_by: {
        name: user?.full_name || 'N/A',
        email: user?.email || 'N/A',
        phone: user?.phone || 'N/A',
        role: user?.role || 'N/A'
      },

      // Sender Information
      sender: {
        name: parcel.sender_name,
        phone: parcel.sender_phone,
      },

      // Receiver Information
      receiver: {
        name: parcel.receiver_name,
        phone: parcel.receiver_phone,
      },

      // Parcel Details
      parcel: {
        tracking_number: parcel.tracking_number,
        description: parcel.description || 'N/A',
        weight: parcel.weight ? `${parcel.weight} kg` : 'N/A',
        amount: `KES ${parseFloat(parcel.amount).toLocaleString()}`,
        payment_method: parcel.payment_method || 'Cash',
        payment_status: parcel.payment_status === 'paid' ? 'Paid at Origin' : 'Pay at Destination',
        status: parcel.status || 'pending',
        destination: destBranch ? `${destBranch.name} (${destBranch.town})` : 'N/A',
        booked_at: new Date(parcel.created_at).toLocaleString('en-KE')
      },

      // Footer
      footer: {
        thank_you: "Thank you for choosing our services!",
        message: "Your parcel is in safe hands. Track your parcel anytime using the tracking number above.",
        website: company?.website || 'N/A',
        support: company?.support_email || company?.email || 'N/A',
        disclaimer: "This is a system generated receipt. No signature required."
      },

      // QR Code data
      qr_data: `TRACK:${parcel.tracking_number}|AMT:${parcel.amount}|DEST:${destBranch?.code || 'N/A'}`
    };

    console.log("✅ Booking receipt generated:", receipt.receipt_number);
    return receipt;
  }

  // Generate receipt for parcel release
 // In receipt.service.js - update generateReleaseReceipt method
generateReleaseReceipt(parcel, user, company, branch, collector, paymentMethod) {
  console.log("🧾 Generating release receipt for parcel:", parcel.tracking_number);
  
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = date.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Generate release receipt number
  const releaseNumber = `RLS-${parcel.tracking_number}-${Date.now().toString().slice(-6)}`;

  const receipt = {
    receipt_number: releaseNumber,
    tracking_number: parcel.tracking_number,
    generated_at: `${formattedDate} ${formattedTime}`,
    receipt_type: 'RELEASE',
    
    // Company Information
    company: {
      name: company?.name || 'Company Name',
      code: company?.code || 'N/A',
      logo: company?.logo_url || null,
      contact: {
        phone: company?.phone || 'N/A',
        email: company?.email || 'N/A',
        website: company?.website || 'N/A'
      }
    },

    // Branch Information
    origin_branch: {
      name: branch?.name || 'N/A',
      code: branch?.code || 'N/A',
      town: branch?.town || 'N/A',
      address: branch?.address || 'N/A'
    },

    // Staff Information
    served_by: {
      name: user?.full_name || 'N/A',
      email: user?.email || 'N/A',
      phone: user?.phone || 'N/A',
      role: user?.role || 'N/A'
    },

    // Sender Information
    sender: {
      name: parcel.sender_name,
      phone: parcel.sender_phone,
    },

    // Receiver Information
    receiver: {
      name: parcel.receiver_name,
      phone: parcel.receiver_phone,
    },

    // Collector Information
    collector: {
      name: collector.name,
      id_number: collector.id_number,
      phone: collector.phone,
      relationship: collector.relationship
    },

    // Parcel Details
    parcel: {
      tracking_number: parcel.tracking_number,
      description: parcel.description || 'N/A',
      weight: parcel.weight ? `${parcel.weight} kg` : 'N/A',
      amount: `KES ${parseFloat(parcel.amount).toLocaleString()}`,
      payment_method: paymentMethod || parcel.payment_method || 'Cash',
      payment_status: 'Paid at Pickup',
      status: 'delivered',
      destination: parcel.destination_branch_name || branch?.name || 'N/A',
      booked_at: new Date(parcel.created_at).toLocaleString('en-KE'),
      released_at: `${formattedDate} ${formattedTime}`
    },

    // Footer
    footer: {
      thank_you: "Thank you for choosing our services!",
      message: "Your parcel has been successfully released. Thank you for using our services.",
      website: company?.website || 'N/A',
      support: company?.support_email || company?.email || 'N/A',
      disclaimer: "This is a system generated release receipt. No signature required."
    },

    // QR Code data
    qr_data: `RELEASED:${parcel.tracking_number}|COL:${collector.name}|TIME:${Date.now()}`
  };

  console.log("✅ Release receipt generated:", receipt.receipt_number);
  return receipt;
}

  // Format receipt for printing/display
  formatReceiptForDisplay(receipt) {
    return {
      ...receipt,
      display_lines: this.generateDisplayLines(receipt)
    };
  }

  // Generate text lines for simple display
  generateDisplayLines(receipt) {
    const lines = [];
    
    // Header
    lines.push('='.repeat(40));
    lines.push(receipt.company.name.toUpperCase());
    lines.push('='.repeat(40));
    lines.push('');
    
    // Receipt Type
    lines.push(`📋 ${receipt.receipt_type} RECEIPT`);
    lines.push('='.repeat(40));
    lines.push('');
    
    // Receipt Info
    lines.push(`Receipt No: ${receipt.receipt_number}`);
    lines.push(`Date: ${receipt.generated_at}`);
    lines.push('');
    
    // Tracking
    lines.push('📦 TRACKING INFORMATION');
    lines.push('-'.repeat(40));
    lines.push(`Tracking No: ${receipt.tracking_number}`);
    lines.push(`Status: ${receipt.parcel.status}`);
    lines.push('');
    
    // Sender/Receiver
    lines.push('👤 SENDER');
    lines.push(`Name: ${receipt.sender.name}`);
    lines.push(`Phone: ${receipt.sender.phone}`);
    lines.push('');
    
    lines.push('👥 RECEIVER');
    lines.push(`Name: ${receipt.receiver.name}`);
    lines.push(`Phone: ${receipt.receiver.phone}`);
    lines.push('');
    
    // Collector (for release receipts)
    if (receipt.collector) {
      lines.push('🆔 COLLECTOR');
      lines.push(`Name: ${receipt.collector.name}`);
      lines.push(`ID: ${receipt.collector.id_number}`);
      lines.push(`Phone: ${receipt.collector.phone}`);
      lines.push(`Relationship: ${receipt.collector.relationship}`);
      lines.push('');
    }
    
    // Parcel Details
    lines.push('📋 PARCEL DETAILS');
    lines.push('-'.repeat(40));
    lines.push(`Description: ${receipt.parcel.description}`);
    lines.push(`Weight: ${receipt.parcel.weight}`);
    lines.push(`Destination: ${receipt.parcel.destination}`);
    lines.push(`Amount: ${receipt.parcel.amount}`);
    lines.push(`Payment: ${receipt.parcel.payment_status}`);
    lines.push(`Payment Method: ${receipt.parcel.payment_method}`);
    lines.push('');
    
    // Release info
    if (receipt.parcel.released_at) {
      lines.push('✅ RELEASE INFORMATION');
      lines.push(`Released At: ${receipt.parcel.released_at}`);
      lines.push('');
    }
    
    // Staff
    lines.push('🛃 SERVED BY');
    lines.push(`Name: ${receipt.served_by.name}`);
    lines.push(`Role: ${receipt.served_by.role}`);
    lines.push('');
    
    // Footer
    lines.push('='.repeat(40));
    lines.push(receipt.footer.thank_you);
    lines.push(receipt.footer.message);
    lines.push('='.repeat(40));
    lines.push(`Track online: ${receipt.company.website}`);
    lines.push(`Support: ${receipt.footer.support}`);
    lines.push(receipt.footer.disclaimer);
    
    return lines;
  }
}

module.exports = new ReceiptService();