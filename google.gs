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
    
    // บันทึกลง Row ใหม่
    sheet.appendRow([
      new Date(), 
      userId, 
      displayName, 
      statusMessage, 
      email, 
      phone, // คอลัมน์เบอร์โทรศัพท์
      pictureUrl
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
