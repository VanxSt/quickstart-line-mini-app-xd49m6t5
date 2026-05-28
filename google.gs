function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var userId = data.userId;
    var displayName = data.displayName;
    var statusMessage = data.statusMessage;
    var email = data.email;
    var phone = data.phone; // ดึงค่าเบอร์โทรศัพท์ที่ LINE ส่งมาอัตโนมัติ
    var pictureUrl = data.pictureUrl;
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // ตรวจสอบว่าผู้ใช้คนนี้เคยลงทะเบียนหรือมีข้อมูลอยู่แล้วหรือไม่ (ค้นหาจาก userId ในคอลัมน์ B)
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var foundRow = -1;
    
    // วนลูปค้นหาจากแถวที่ 2 (ดัชนี 1) เป็นต้นไปเพื่อข้ามแถวหัวตาราง (Header)
    for (var i = 1; i < values.length; i++) {
      if (values[i][1] === userId) { // คอลัมน์ที่ 2 (ดัชนี 1) คือ userId
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
      sheet.getRange(foundRow, 6).setValue(phone);
      sheet.getRange(foundRow, 7).setValue(pictureUrl);
    } else {
      // หากยังไม่มีข้อมูลผู้ใช้รายนี้ ให้ทำการบันทึกแถวใหม่
      sheet.appendRow([
        new Date(), 
        userId, 
        displayName, 
        statusMessage, 
        email, 
        phone, 
        pictureUrl
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
