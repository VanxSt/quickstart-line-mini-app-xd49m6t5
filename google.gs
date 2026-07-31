// ==========================================
// การตั้งค่า LINE Messaging API
// ==========================================
// 1. ใส่ Channel Access Token ของ LINE OA (Long-lived) 
const LINE_ACCESS_TOKEN = 'UTqQBlXZsz1FHhyz3elJBbwW/Sy3ex26+xhkqy6OpjuUL6Y3gB1QYI3+CCwARapxDVxivd5Iw6TYL64IO0Kz0ykDLJ8qDJrSrDnQdrugEu14xp4MU7mClHJG03GszZzgnS9DHafrq38iKUNHtCyokQdB04t89/1O/w1cDnyilFU=';

// 2. เบอร์ PromptPay ของร้านค้า
const SHOP_PROMPTPAY_ID = '0957579454';
// ==========================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'register';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'createOrder') {
      return createOrderHandler(ss, data);
    } else if (action === 'updateOrderStatus') {
      return updateOrderStatusHandler(ss, data);
    } else {
      // Default: register/update member profile
      return registerMemberHandler(ss, data);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handler สำหรับอัปเดตสถานะคำสั่งซื้อจากหน้า Admin
function updateOrderStatusHandler(ss, data) {
  try {
    var orderId = data.orderId;
    var newStatus = data.status; // เช่น "รอชำระเงิน", "กำลังจัดส่ง", "ยกเลิก"
    
    // เรียกใช้ฟังก์ชันหลักที่มีระบบส่งแจ้งเตือน LINE ไปด้วย
    var result = updateOrderStatusNative(orderId, newStatus);
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handler สำหรับบันทึกคำสั่งซื้อใหม่
function createOrderHandler(ss, data) {
  try {
    var userId = data.userId || 'unknown';
    var displayName = data.displayName || '';
    // เติม Single Quote นำหน้าเบอร์โทร เพื่อบังคับให้ Google Sheets มองเป็นข้อความ (Plain Text) ไม่ต้องเสียเวลาเซ็ต Format อีกรอบ
    var phone = data.phone ? "'" + data.phone : "";
    var gpsLocation = data.gpsLocation || '';
    var addressDetails = data.addressDetails || '';
    var paymentMethod = data.paymentMethod || 'ปลายทาง'; // รับค่า Payment Method
    var totalPrice = Number(data.totalPrice || 0);
    var items = data.items || [];
    
    // สร้าง Order ID แบบไม่ซ้ำกัน
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
    var ordersHeaders = ["Timestamp", "Order ID", "User ID", "Name", "Phone", "GPS Location", "Address Details", "Slip Image URL", "Total Price", "Status", "Payment Method"];
    var ordersSheet = getFastSheet(ss, "Orders", ordersHeaders);
    
    // บันทึกคำสั่งซื้อลงชีต Orders (1 API Call)
    ordersSheet.appendRow([
      timestamp,
      orderId,
      userId,
      displayName,
      phone,
      gpsFormula,
      addressDetails,
      slipFormula,
      totalPrice,
      "รอตรวจสอบ", // สถานะเริ่มต้น
      paymentMethod
    ]);
    
    // ดึงหรือสร้างชีต "OrderDetails"
    var detailsHeaders = ["Order ID", "Customer Name", "Phone", "Product ID", "Product Name", "Unit Price", "Quantity", "Subtotal", "GPS Location"];
    var detailsSheet = getFastSheet(ss, "OrderDetails", detailsHeaders);
    
    // เตรียมข้อมูลสินค้าทั้งหมดเพื่อบันทึกรวดเดียว (Batch Insert)
    var detailsData = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var subtotal = Number(item.price || 0) * Number(item.qty || 1);
      detailsData.push([
        orderId,
        displayName,
        phone,
        item.id,
        item.name,
        item.price,
        item.qty,
        subtotal,
        gpsFormula
      ]);
    }
    
    // บันทึกรายการสินค้าทั้งหมดในครั้งเดียว (1 API Call) ประหยัดเวลามาก
    if (detailsData.length > 0) {
      var lastRow = detailsSheet.getLastRow();
      detailsSheet.getRange(lastRow + 1, 1, detailsData.length, detailsData[0].length).setValues(detailsData);
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


// ฟังก์ชันช่วยเหลือสำหรับค้นหาหรือสร้างชีตแบบรวดเร็ว (ลดการอ่าน/เขียนเกินความจำเป็น)
function getFastSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = e.parameter.action;
    
// Action 0: แสดงหน้าเว็บ Admin Dashboard
    if (action === 'admin') {
      return HtmlService.createHtmlOutputFromFile('admin')
        .setTitle('Admin Dashboard - จัดการคำสั่งซื้อ')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
    
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
    
    // Action 1.6: ดึงข้อมูลออเดอร์ทั้งหมด (สำหรับ Admin)
    if (action === 'getAllOrders') {
      var ordersSheet = ss.getSheetByName("Orders");
      var detailsSheet = ss.getSheetByName("OrderDetails");
      
      if (!ordersSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', orders: [] })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var orderValues = ordersSheet.getDataRange().getValues();
      var orders = [];
      
      // ดึงรายละเอียดออเดอร์ (Items) ล่วงหน้าเพื่อนำไปเชื่อมโยง
      var detailsMap = {};
      if (detailsSheet) {
        var detailValues = detailsSheet.getDataRange().getValues();
        for (var j = 1; j < detailValues.length; j++) {
          var dRow = detailValues[j];
          var dOrderId = dRow[0];
          if (!detailsMap[dOrderId]) detailsMap[dOrderId] = [];
          detailsMap[dOrderId].push({
            id: dRow[3],
            name: dRow[4],
            price: dRow[5],
            qty: dRow[6],
            subtotal: dRow[7]
          });
        }
      }
      
      // วนลูปจากใหม่ไปเก่า (ล่างสุดไปบนสุด)
      for (var k = orderValues.length - 1; k >= 1; k--) {
        var oRow = orderValues[k];
        if (!oRow[1]) continue; // ข้ามแถวว่าง
        
        orders.push({
          timestamp: oRow[0],
          orderId: oRow[1],
          userId: oRow[2],
          customerName: oRow[3],
          phone: oRow[4],
          gpsLocation: oRow[5],
          addressDetails: oRow[6],
          totalPrice: oRow[8],
          status: oRow[9] || 'รอตรวจสอบ',
          items: detailsMap[oRow[1]] || []
        });
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', orders: orders })).setMimeType(ContentService.MimeType.JSON);
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

// ฟังก์ชันสำหรับใช้กดรันครั้งแรกในตัวแก้ไขสคริปต์ เพื่อยอมรับสิทธิ์
function triggerAuthorization() {
  DriveApp.getRootFolder();
  UrlFetchApp.fetch("https://www.google.com", { muteHttpExceptions: true });
  Logger.log("อนุมัติสิทธิ์การเข้าถึง Google Drive และ External Request สำเร็จแล้ว!");
}

// ==========================================
// ฟังก์ชันสำหรับเรียกใช้ตรงจากหน้า admin.html (google.script.run)
// ==========================================
function getAllOrdersNative() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName("Orders");
  var detailsSheet = ss.getSheetByName("OrderDetails");
  
  if (!ordersSheet) return [];
  
  var orderValues = ordersSheet.getDataRange().getValues();
  var orders = [];
  
  var detailsMap = {};
  if (detailsSheet) {
    var detailValues = detailsSheet.getDataRange().getValues();
    for (var j = 1; j < detailValues.length; j++) {
      var dRow = detailValues[j];
      var dOrderId = dRow[0];
      if (!detailsMap[dOrderId]) detailsMap[dOrderId] = [];
      detailsMap[dOrderId].push({
        id: dRow[3],
        name: dRow[4],
        price: dRow[5],
        qty: dRow[6],
        subtotal: dRow[7]
      });
    }
  }
  
  for (var k = orderValues.length - 1; k >= 1; k--) {
    var oRow = orderValues[k];
    if (!oRow[1]) continue;
    
    // แปลง Date เป็น String เพื่อให้ google.script.run ส่งค่ากลับไปได้
    var ts = oRow[0];
    if (ts instanceof Date) {
      ts = ts.toISOString();
    }
    
    orders.push({
      timestamp: ts,
      orderId: oRow[1],
      userId: oRow[2],
      customerName: oRow[3],
      phone: oRow[4],
      gpsLocation: oRow[5],
      addressDetails: oRow[6],
      totalPrice: oRow[8],
      status: oRow[9] || 'รอตรวจสอบ',
      paymentMethod: oRow[10] || 'ไม่ระบุ',
      items: detailsMap[oRow[1]] || []
    });
  }
  
  return orders;
}

function updateOrderStatusNative(orderId, newStatus) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName("Orders");
  var values = ordersSheet.getDataRange().getValues();
  var foundRow = -1;
  var userId = "";
  var paymentMethod = "";
  var totalPrice = 0;
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][1] && values[i][1].toString() === orderId) {
      foundRow = i + 1;
      userId = values[i][2]; // User ID อยู่คอลัมน์ 3 (index 2)
      totalPrice = values[i][8] || 0; // Total Price อยู่คอลัมน์ 9 (index 8)
      paymentMethod = values[i][10] || "ปลายทาง"; // Payment Method อยู่คอลัมน์ 11 (index 10)
      break;
    }
  }
  
  if (foundRow !== -1) {
    ordersSheet.getRange(foundRow, 10).setValue(newStatus);
    
    // ส่งข้อความแจ้งเตือนผ่าน LINE ทันทีที่มีการเปลี่ยนสถานะ
    if (userId && userId !== 'unknown' && userId !== 'web-test-user' && LINE_ACCESS_TOKEN !== 'YOUR_LINE_ACCESS_TOKEN_HERE') {
      try {
        var messages = [];
        
        if (newStatus === "กำลังจัดส่ง" && paymentMethod === "ปลายทาง") {
           messages.push({
             "type": "text",
             "text": "📦 ออเดอร์ " + orderId + " ของคุณได้รับการยืนยันแล้ว!\nขณะนี้ร้านกำลังเตรียมสินค้าและจัดส่งให้คุณ (ชำระเงินปลายทาง)\nขอบคุณที่อุดหนุนครับ 😊"
           });
        } 
        else if (newStatus === "รอชำระเงิน" && paymentMethod === "โอนจ่าย") {
           messages.push({
             "type": "text",
             "text": "แอดมินยืนยันออเดอร์แล้วครับ\nโอนเงินแล้วส่งสลิปได้เลยนะครับ!"
           });
           // ชั่วคราว ปิดการส่งรูปภาพเพื่อทดสอบว่าข้อความส่งผ่านหรือไม่
           // var staticQrUrl = "https://i.postimg.cc/rwqW0Prh/Screenshot-10.png";
           // messages.push({
           //   "type": "image",
           //   "originalContentUrl": staticQrUrl,
           //   "previewImageUrl": staticQrUrl
           // });
        }
        else if (newStatus === "กำลังจัดส่ง" && paymentMethod === "โอนจ่าย") {
           messages.push({
             "type": "text",
             "text": "📦 แอดมินตรวจสอบยอดเงินเรียบร้อยแล้ว!\nขณะนี้ร้านกำลังเตรียมสินค้าและจัดส่งให้คุณสำหรับออเดอร์ " + orderId + "\nขอบคุณที่อุดหนุนครับ 😊"
           });
        }
        else if (newStatus === "ยกเลิก") {
           messages.push({
             "type": "text",
             "text": "❌ ออเดอร์ " + orderId + " ของคุณถูกยกเลิกแล้วครับ หากมีข้อสงสัยสอบถามแอดมินได้เลยครับ"
           });
        }
        
        if (messages.length > 0) {
          var pushResult = sendLinePushMessage(userId, messages);
          return { status: 'success', debug: pushResult };
        }
      } catch (e) {
        return { status: 'success', debug: 'Catch Error: ' + e.message };
      }
    } else {
      var skipReason = "Skipped - ";
      if (!userId || userId === 'unknown') skipReason += "No User ID";
      else if (userId === 'web-test-user') skipReason += "Tested on PC Browser (web-test-user)";
      else if (LINE_ACCESS_TOKEN === 'YOUR_LINE_ACCESS_TOKEN_HERE') skipReason += "No LINE Token";
      return { status: 'success', debug: skipReason };
    }
    
    return { status: 'success', debug: 'No message to send' };
  }
  return { status: 'error', message: 'ไม่พบออเดอร์' };
}

function sendLinePushMessage(userId, messages) {
  var url = 'https://api.line.me/v2/bot/message/push';
  
  // Ensure userId is a clean string
  var cleanUserId = userId ? userId.toString().trim() : '';
  
  var payload = {
    'to': cleanUserId,
    'messages': messages
  };
  
  var options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    // Return both response and request payload for debugging
    return responseText + "\n[Payload]: " + JSON.stringify(payload);
  } catch (error) {
    return 'Fetch Error: ' + error.message + "\n[Payload]: " + JSON.stringify(payload);
  }
}

