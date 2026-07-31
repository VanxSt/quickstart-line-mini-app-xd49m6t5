function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'register';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'createOrder') {
      return createOrderHandler(ss, data);
    } else {
      // Default: register/update member profile
      return registerMemberHandler(ss, data);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handler สำหรับบันทึกคำสั่งซื้อใหม่
function createOrderHandler(ss, data) {
  try {
    var userId = data.userId || 'unknown';
    var displayName = data.displayName || '';
    var phone = data.phone || '';
    var gpsLocation = data.gpsLocation || '';
    var addressDetails = data.addressDetails || '';
    var totalPrice = Number(data.totalPrice || 0);
    var items = data.items || [];
    
    // สร้าง Order ID แบบไม่ซ้ำกัน (เช่น ORD-20260601-153012-123)
    var timestamp = new Date();
    var formattedDate = Utilities.formatDate(timestamp, "GMT+7", "yyyyMMdd-HHmmss");
    var rand = Math.floor(Math.random() * 1000);
    var orderId = "ORD-" + formattedDate + "-" + rand;
    

    
    // ปรับแต่งค่า URL เป็น Hyperlink แบบกดได้สำหรับ Google Sheets
    var gpsFormula = gpsLocation;
    if (gpsLocation && gpsLocation.indexOf("http") === 0) {
      gpsFormula = '=HYPERLINK("' + gpsLocation + '", "📌 เปิดแผนที่ Google Maps")';
    }
    
    var slipFormula = "";
    
    // ดึงหรือสร้างชีต "Orders"
    var ordersHeaders = ["Timestamp", "Order ID", "User ID", "Name", "Phone", "GPS Location", "Address Details", "Slip Image URL", "Total Price", "Status"];
    var ordersSheet = getOrCreateSheet(ss, "Orders", ordersHeaders);
    
    // บันทึกคำสั่งซื้อรวมลงชีต Orders
    ordersSheet.appendRow([
      timestamp,
      orderId,
      userId,
      displayName,
      "", // เว้นโทรศัพท์ไว้เพื่อเซ็ตฟอร์แมต Plain text ป้องกันเลข 0 หาย
      gpsFormula,
      addressDetails,
      slipFormula,
      totalPrice,
      "รอตรวจสอบ" // สถานะเริ่มต้น
    ]);
    
    // ตั้งค่าฟอร์แมตเบอร์โทรศัพท์ในคอลัมน์ Phone (คอลัมน์ที่ 5)
    var lastRowOrders = ordersSheet.getLastRow();
    ordersSheet.getRange(lastRowOrders, 5).setNumberFormat('@').setValue(phone);
    
    // ดึงหรือสร้างชีต "OrderDetails" (เพิ่ม Name, Phone และ GPS ในรายละเอียดสินค้าด้วยตามขอ)
    var detailsHeaders = ["Order ID", "Customer Name", "Phone", "Product ID", "Product Name", "Unit Price", "Quantity", "Subtotal", "GPS Location"];
    var detailsSheet = getOrCreateSheet(ss, "OrderDetails", detailsHeaders);
    
    // บันทึกรายการสินค้าแต่ละชิ้นลงชีต OrderDetails
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var subtotal = Number(item.price || 0) * Number(item.qty || 1);
      detailsSheet.appendRow([
        orderId,
        displayName,
        "", // เว้นเบอร์โทรไว้สำหรับเซ็ต Plain text ป้องกันเลข 0 หาย
        item.id,
        item.name,
        item.price,
        item.qty,
        subtotal,
        gpsFormula
      ]);
      
      // ตั้งค่าฟอร์แมตเบอร์โทรศัพท์ในคอลัมน์ที่ 3 ของชีต OrderDetails
      var lastRowDetails = detailsSheet.getLastRow();
      detailsSheet.getRange(lastRowDetails, 3).setNumberFormat('@').setValue(phone);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      orderId: orderId
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: 'Failed to create order: ' + error.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handler สำหรับลงทะเบียน/อัปเดตข้อมูลสมาชิก (โค้ดเดิมที่ปรับปรุงโครงสร้าง)
function registerMemberHandler(ss, data) {
  var userId = data.userId;
  var displayName = data.displayName;
  var statusMessage = data.statusMessage;
  var email = data.email;
  var phone = data.phone;
  var pictureUrl = data.pictureUrl;
  
  var sheet = ss.getSheetByName("Members") || ss.getSheets()[0];
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var foundRow = -1;
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][1] && values[i][1].toString().trim() === userId.toString().trim()) {
      foundRow = i + 1;
      break;
    }
  }
  
  if (foundRow !== -1) {
    sheet.getRange(foundRow, 1).setValue(new Date());
    sheet.getRange(foundRow, 3).setValue(displayName);
    sheet.getRange(foundRow, 4).setValue(statusMessage);
    sheet.getRange(foundRow, 5).setValue(email);
    sheet.getRange(foundRow, 6).setValue(pictureUrl);
    sheet.getRange(foundRow, 7).setNumberFormat('@').setValue(phone);
  } else {
    sheet.appendRow([
      new Date(), 
      userId, 
      displayName, 
      statusMessage, 
      email, 
      pictureUrl, 
      ""
    ]);
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 7).setNumberFormat('@').setValue(phone);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}


// ฟังก์ชันช่วยเหลือสำหรับค้นหาหรือสร้างชีตใหม่พร้อมกำหนดหัวตาราง (Headers)
function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    // ทำตัวหนาแถวหัวตาราง
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  } else {
    // ตรวจสอบว่าหัวข้อคอลัมน์ (Row 1) ตรงกันหรือไม่
    var lastCol = sheet.getLastColumn();
    var currentHeaders = [];
    if (lastCol > 0) {
      currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    
    var isMatch = currentHeaders.length === headers.length;
    if (isMatch) {
      for (var i = 0; i < headers.length; i++) {
        if (currentHeaders[i] !== headers[i]) {
          isMatch = false;
          break;
        }
      }
    }
    
    // หากหัวข้อไม่ตรงกัน (มีการอัปเดตโครงสร้างคอลัมน์) ให้ล้างข้อมูลเดิมและเขียนหัวข้อใหม่ทั้งหมดเพื่อป้องกันข้อมูลเหลื่อมกัน
    if (!isMatch) {
      sheet.clear();
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
  }
  return sheet;
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
      
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (!row[0] && row[0] !== 0) continue;
        
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
      
      var activeProducts = products.filter(function(p) {
        return p.status.toLowerCase() !== 'inactive';
      });
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        products: activeProducts 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Action 1.5: ดึงข้อมูลประวัติการสั่งซื้อของลูกค้า
    if (action === 'getMyOrders') {
      var userIdParam = e.parameter.userId;
      if (!userIdParam) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing userId' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var ordersSheet = ss.getSheetByName("Orders");
      if (!ordersSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', orders: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var values = ordersSheet.getDataRange().getValues();
      var myOrders = [];
      // วนลูปจากแถวล่างสุดไปบนสุด เพื่อให้เห็นออเดอร์ล่าสุดก่อน
      for (var i = values.length - 1; i >= 1; i--) {
        var row = values[i];
        if (row[2] && row[2].toString().trim() === userIdParam.toString().trim()) {
          myOrders.push({
            timestamp: row[0],
            orderId: row[1],
            totalPrice: row[8],
            status: row[9] || 'รอตรวจสอบ'
          });
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', orders: myOrders }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Action 1.8: แอดมินยืนยันออเดอร์จาก LINE
    if (action === 'confirmOrder') {
      var orderIdToConfirm = e.parameter.orderId;
      if (!orderIdToConfirm) {
        return HtmlService.createHtmlOutput('<div style="text-align: center; font-family: sans-serif; padding: 50px;"><h1>❌ ไม่พบรหัสออเดอร์</h1></div>');
      }
      var ordersSheet = ss.getSheetByName("Orders");
      if (!ordersSheet) {
        return HtmlService.createHtmlOutput('<div style="text-align: center; font-family: sans-serif; padding: 50px;"><h1>❌ ไม่พบฐานข้อมูลออเดอร์</h1></div>');
      }
      
      var values = ordersSheet.getDataRange().getValues();
      var foundRow = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][1] && values[i][1].toString() === orderIdToConfirm) {
          foundRow = i + 1; // +1 เพราะ array เริ่มที่ 0 แต่แถว Sheet เริ่มที่ 1
          break;
        }
      }
      
      if (foundRow !== -1) {
        ordersSheet.getRange(foundRow, 10).setValue("ยืนยันแล้ว"); // คอลัมน์ที่ 10 คือ Status
        var html = '<div style="font-family: sans-serif; text-align: center; padding: 50px 20px;">' +
                   '<h1 style="color: #10b981; font-size: 40px; margin-bottom: 10px;">✅</h1>' +
                   '<h2 style="color: #10b981; margin-top: 0;">ยืนยันออเดอร์สำเร็จ!</h2>' +
                   '<p style="font-size: 18px;">ออเดอร์ <b>' + orderIdToConfirm + '</b> ถูกเปลี่ยนสถานะเป็น "ยืนยันแล้ว"</p>' +
                   '<p style="color: #666; margin-top: 30px;">คุณสามารถปิดหน้านี้แล้วกลับไปที่แชท LINE ได้เลยครับ</p>' +
                   '</div>';
        // ใช้ <meta name="viewport"> เพื่อให้แสดงผลบนมือถือได้พอดี
        html = '<meta name="viewport" content="width=device-width, initial-scale=1.0">' + html;
        return HtmlService.createHtmlOutput(html);
      } else {
        return HtmlService.createHtmlOutput('<div style="text-align: center; font-family: sans-serif; padding: 50px;"><h2 style="color: #ef4444;">❌ ไม่พบออเดอร์รหัส:<br>' + orderIdToConfirm + '</h2></div>');
      }
    }
    
    // Action 2: ดึงข้อมูลสมาชิก
    var userId = e.parameter.userId;
    if (!userId) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing userId' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var memberSheet = ss.getSheetByName("Members") || ss.getSheets()[0];
    var dataRange = memberSheet.getDataRange();
    var values = dataRange.getValues();
    
    for (var i = 1; i < values.length; i++) {
      if (values[i][1] && values[i][1].toString().trim() === userId.toString().trim()) {
        var userData = {
          status: 'success',
          found: true,
          userId: values[i][1],
          displayName: values[i][2],
          statusMessage: values[i][3],
          email: values[i][4],
          pictureUrl: values[i][5],
          phone: values[i][6]
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

// ฟังก์ชันสำหรับใช้กดรันครั้งแรกในตัวแก้ไขสคริปต์ เพื่อยอมรับสิทธิ์การใช้งาน Google Drive (DriveApp)
function triggerAuthorization() {
  DriveApp.getRootFolder();
  Logger.log("อนุมัติสิทธิ์การเข้าถึง Google Drive สำเร็จแล้ว!");
}
