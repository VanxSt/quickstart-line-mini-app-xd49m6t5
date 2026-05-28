function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var userId = data.userId;
    var displayName = data.displayName;
    var statusMessage = data.statusMessage;
    var email = data.email;
    var phone = data.phone; // ดึงค่าเบอร์โทรศัพท์ที่ LINE ส่งมาอัตโนมัติ
    var pictureUrl = data.pictureUrl;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    // ดึงจากชีตชื่อ "Members" หรือใช้ชีตแรกหากหาไม่เจอ
    var sheet = ss.getSheetByName("Members") || ss.getSheets()[0];
    
    // ตรวจสอบว่าผู้ใช้คนนี้เคยลงทะเบียนหรือมีข้อมูลอยู่แล้วหรือไม่ (ค้นหาจาก userId ในคอลัมน์ B)
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var foundRow = -1;
    
    // วนลูปค้นหาจากแถวที่ 2 (ดัชนี 1) เป็นต้นไปเพื่อข้ามแถวหัวตาราง (Header)
    for (var i = 1; i < values.length; i++) {
      if (values[i][1] && values[i][1].toString().trim() === userId.toString().trim()) { // คอลัมน์ที่ 2 คือ userId
        foundRow = i + 1; // ดัชนีแถวใน getRange เริ่มต้นที่ 1
        break;
      }
    }
    
    if (foundRow !== -1) {
      // หากพบข้อมูลเดิมอยู่แล้ว ให้ทำการอัปเดตข้อมูลเดิมในแถวนั้นๆ ป้องกันการบันทึกซ้ำ
      sheet.getRange(foundRow, 1).setValue(new Date()); // อัปเดตเวลาล่าสุด
      sheet.getRange(foundRow, 3).setValue(displayName);
      sheet.getRange(foundRow, 4).setValue(statusMessage);
      sheet.getRange(foundRow, 5).setValue(email);
      sheet.getRange(foundRow, 6).setValue(pictureUrl); // คอลัมน์ F (6) คือ Picture URL
      sheet.getRange(foundRow, 7).setNumberFormat('@').setValue(phone); // คอลัมน์ G (7) คือ Phone (ตั้งค่าเป็นข้อความเพื่อรักษาเลข 0)
    } else {
      // หากยังไม่มีข้อมูลผู้ใช้รายนี้ ให้ทำการบันทึกแถวใหม่
      sheet.appendRow([
        new Date(), 
        userId, 
        displayName, 
        statusMessage, 
        email, 
        pictureUrl, // คอลัมน์ F (6) คือ Picture URL
        ""          // ใส่ค่าว่างไว้ก่อนในคอลัมน์ G (7) เพื่อตั้งค่ารูปแบบทีหลัง
      ]);
      // ดึงแถวล่าสุดแล้วตั้งค่าเบอร์โทรศัพท์เป็น Plain Text เพื่อไม่ให้เลข 0 นำหน้าหาย
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 7).setNumberFormat('@').setValue(phone);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = e.parameter.action;
    
    // Action 1: ดึงข้อมูลสินค้าจากชีต Catalog
    if (action === 'getProducts') {
      var catalogSheet = ss.getSheetByName("Catalog");
      if (!catalogSheet) {
        return ContentService.createTextOutput(JSON.stringify({ 
          status: 'error', 
          message: 'ไม่พบชีตชื่อ "Catalog" กรุณาสร้างชีตใหม่ชื่อ "Catalog" ใน Google Sheets ของคุณก่อนครับ' 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var values = catalogSheet.getDataRange().getValues();
      var products = [];
      
      // ข้ามหัวตาราง (แถว 1 / index 0)
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (!row[0] && row[0] !== 0) continue; // ข้ามถ้ารหัสสินค้าว่างเปล่า
        
        products.push({
          id: Number(row[0]),
          name: String(row[1] || ''),
          category: String(row[2] || ''),
          price: Number(row[3] || 0),
          desc: String(row[4] || ''),
          img: String(row[5] || ''),
          tag: String(row[6] || ''),
          status: String(row[7] || 'active')
        });
      }
      
      // กรองสินค้าที่สถานะไม่ใช่ inactive
      var activeProducts = products.filter(function(p) {
        return p.status.toLowerCase() !== 'inactive';
      });
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        products: activeProducts 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Action 2: ดึงข้อมูลสมาชิก (เดิม)
    var userId = e.parameter.userId;
    if (!userId) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing userId' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var memberSheet = ss.getSheetByName("Members") || ss.getSheets()[0];
    var dataRange = memberSheet.getDataRange();
    var values = dataRange.getValues();
    
    for (var i = 1; i < values.length; i++) {
      if (values[i][1] && values[i][1].toString().trim() === userId.toString().trim()) { // คอลัมน์ที่ 2 คือ userId
        var userData = {
          status: 'success',
          found: true,
          userId: values[i][1],
          displayName: values[i][2],
          statusMessage: values[i][3],
          email: values[i][4],
          pictureUrl: values[i][5], // คอลัมน์ F (ดัชนี 5) คือ Picture URL
          phone: values[i][6]       // คอลัมน์ G (ดัชนี 6) คือ Phone
        };
        return ContentService.createTextOutput(JSON.stringify(userData))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', found: false }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
