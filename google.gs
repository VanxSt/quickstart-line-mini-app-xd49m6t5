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
    var addressLabel = data.addressLabel || '';
    var paymentMethod = data.paymentMethod || 'ปลายทาง'; // รับค่า Payment Method
    var totalPrice = Number(data.totalPrice || 0);
    var items = data.items || [];
    
    var deliveryType = data.deliveryType || 'ทันที';
    var preorderTime = data.preorderTime || '';
    var shippingOption = data.shippingOption || 'จัดส่ง';
    
    // สร้าง Order ID แบบไม่ซ้ำกัน (หรือรับค่ามาจาก Frontend ถ้ามีการส่งมา)
    var timestamp = new Date();
    var formattedDate = Utilities.formatDate(timestamp, "GMT+7", "yyyyMMdd-HHmmss");
    var rand = Math.floor(Math.random() * 1000);
    var orderId = data.orderId || ("ORD-" + formattedDate + "-" + rand);
    
    // ปรับแต่งค่า URL เป็น Hyperlink แบบกดได้สำหรับ Google Sheets
    var gpsFormula = gpsLocation;
    if (gpsLocation && gpsLocation.indexOf("http") === 0) {
      gpsFormula = '=HYPERLINK("' + gpsLocation + '", "📌 เปิดแผนที่ Google Maps")';
    }
    
    var slipFormula = "";
    
    // ดึงหรือสร้างชีต "Orders"
    var ordersHeaders = ["Timestamp", "Order ID", "User ID", "Name", "Phone", "GPS Location", "Address Details", "Slip Image URL", "Total Price", "Status", "Payment Method", "Order Items", "Items JSON", "Delivery Type", "Preorder Time", "Shipping Option"];
    var ordersSheet = getFastSheet(ss, "Orders", ordersHeaders);
    
    // สร้างข้อความรายการสินค้าให้อ่านง่ายสำหรับมนุษย์
    var itemsText = items.map(function(item) {
      return item.name + " x" + item.qty;
    }).join(", ");
    
    // สร้าง JSON string สำหรับระบบ API
    var itemsJson = JSON.stringify(items);
    
    var displayAddress = addressDetails;
    if (shippingOption === 'รับหน้าร้าน') {
      displayAddress = "🏪 [รับหน้าร้าน] " + (deliveryType === 'ล่วงหน้า' && preorderTime ? "🕒 สั่งล่วงหน้า: " + preorderTime + " น." : "รับทันที");
    } else if (deliveryType === 'ล่วงหน้า' && preorderTime) {
      displayAddress = "🕒 [สั่งล่วงหน้า: " + preorderTime + " น.] " + addressDetails;
    }
    
    // บันทึกคำสั่งซื้อลงชีต Orders (1 API Call)
    ordersSheet.appendRow([
      timestamp,
      orderId,
      userId,
      displayName,
      phone,
      gpsFormula,
      displayAddress,
      slipFormula,
      totalPrice,
      "รอตรวจสอบ", // สถานะเริ่มต้น
      paymentMethod,
      itemsText,
      itemsJson,
      deliveryType,
      preorderTime,
      shippingOption
    ]);
    
    // อัปเดตข้อมูลเบอร์โทร และที่อยู่ล่าสุดในชีต Members ทันทีที่มีออเดอร์ใหม่
    if (userId && userId !== 'unknown' && userId !== 'web-test-user') {
      try {
        var membersSheet = ss.getSheetByName("Members") || ss.getSheets()[0];
        if (membersSheet) {
          // ตรวจสอบและสร้างหัวข้อตารางคอลัมน์ H, I, J, K ของชีต Members ถ้ายังไม่มี
          if (membersSheet.getLastColumn() < 11 || !membersSheet.getRange(1, 11).getValue()) {
            membersSheet.getRange(1, 8).setValue("GPS Location");
            membersSheet.getRange(1, 9).setValue("Address Details");
            membersSheet.getRange(1, 10).setValue("Address Label");
            membersSheet.getRange(1, 11).setValue("Saved Addresses JSON");
          }
          
          var mValues = membersSheet.getDataRange().getValues();
          var mRow = -1;
          for (var idx = 1; idx < mValues.length; idx++) {
            if (mValues[idx][1] && mValues[idx][1].toString().trim() === userId.toString().trim()) {
              mRow = idx + 1;
              break;
            }
          }
          if (mRow !== -1) {
            // คอลัมน์ 7 (G) = Phone (ดึงตัวนำหน้า quote ออก)
            var cleanPhone = phone ? phone.toString().replace(/'/g, "") : "";
            membersSheet.getRange(mRow, 7).setNumberFormat('@').setValue(cleanPhone);
            
            // อัปเดตพิกัดและที่อยู่ลงประวัติสมาชิกเฉพาะเมื่อเป็นออเดอร์แบบ "จัดส่ง" เท่านั้น
            if (shippingOption !== 'รับหน้าร้าน') {
              // คอลัมน์ 8 (H) = GPS Location
              membersSheet.getRange(mRow, 8).setValue(gpsLocation || "");
              // คอลัมน์ 9 (I) = Address Details
              membersSheet.getRange(mRow, 9).setValue(addressDetails || "");
              // คอลัมน์ 10 (J) = Address Label (ตั้งชื่อที่อยู่)
              membersSheet.getRange(mRow, 10).setValue(addressLabel || "");
              
              // คอลัมน์ 11 (K) = Saved Addresses JSON (เก็บสูงสุด 5 ที่อยู่)
              var savedAddressesStr = membersSheet.getRange(mRow, 11).getValue() || "[]";
              var savedAddresses = [];
              try {
                savedAddresses = JSON.parse(savedAddressesStr);
              } catch(e) {
                savedAddresses = [];
              }
              if (!Array.isArray(savedAddresses)) {
                savedAddresses = [];
              }
              
              var isDuplicate = false;
              for (var s = 0; s < savedAddresses.length; s++) {
                if (savedAddresses[s].gpsLocation === gpsLocation && savedAddresses[s].addressDetails === addressDetails) {
                  isDuplicate = true;
                  savedAddresses[s].label = addressLabel || savedAddresses[s].label || 'ที่อยู่ของฉัน';
                  break;
                }
              }
              
              if (!isDuplicate) {
                savedAddresses.unshift({
                  label: addressLabel || 'ที่อยู่ของฉัน',
                  gpsLocation: gpsLocation,
                  addressDetails: addressDetails
                });
                if (savedAddresses.length > 5) {
                  savedAddresses.pop(); // เก็บสูงสุด 5 ที่อยู่
                }
              }
              
              membersSheet.getRange(mRow, 11).setValue(JSON.stringify(savedAddresses));
            }
          }
        }
      } catch (memErr) {
        Logger.log("Failed to update member profile address: " + memErr.message);
      }
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
      
      if (!ordersSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', orders: [] })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var orderValues = ordersSheet.getDataRange().getValues();
      var orders = [];
      
      // วนลูปจากใหม่ไปเก่า (ล่างสุดไปบนสุด)
      for (var k = orderValues.length - 1; k >= 1; k--) {
        var oRow = orderValues[k];
        if (!oRow[1]) continue; // ข้ามแถวว่าง
        
        var parsedItems = [];
        try {
          if (oRow[12]) parsedItems = JSON.parse(oRow[12]);
        } catch(e) {}
        
        var orderItems = parsedItems;
        
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
          paymentMethod: oRow[10] || 'ปลายทาง',
          items: orderItems,
          deliveryType: oRow[13] || 'ทันที',
          preorderTime: oRow[14] || '',
          shippingOption: oRow[15] || 'จัดส่ง'
        });
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', orders: orders })).setMimeType(ContentService.MimeType.JSON);
    }

    // Action 1.7: ดึงข้อมูลสมาชิกทั้งหมด (สำหรับ Admin)
    if (action === 'getAllMembers') {
      var membersSheet = ss.getSheetByName("Members");
      if (!membersSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', members: [] })).setMimeType(ContentService.MimeType.JSON);
      }
      var mValues = membersSheet.getDataRange().getValues();
      var members = [];
      for (var m = mValues.length - 1; m >= 1; m--) {
        var mRow = mValues[m];
        if (!mRow[1]) continue;
        var mTs = mRow[0];
        if (mTs instanceof Date) mTs = mTs.toISOString();
        members.push({
          registeredAt: mTs,
          userId: mRow[1],
          displayName: mRow[2] || '',
          statusMessage: mRow[3] || '',
          email: mRow[4] || '',
          pictureUrl: mRow[5] || '',
          phone: mRow[6] ? mRow[6].toString().replace(/'/g, "") : '',
          gpsLocation: mRow[7] || '',
          addressDetails: mRow[8] || '',
          addressLabel: mRow[9] || ''
        });
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', members: members })).setMimeType(ContentService.MimeType.JSON);
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
          phone: values[i][6],
          gpsLocation: values[i][7] || '',
          addressDetails: values[i][8] || '',
          addressLabel: values[i][9] || '',
          savedAddresses: values[i][10] || '[]'
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
  
  if (!ordersSheet) return [];
  
  var orderValues = ordersSheet.getDataRange().getValues();
  var orders = [];
  
  for (var k = orderValues.length - 1; k >= 1; k--) {
    var oRow = orderValues[k];
    if (!oRow[1]) continue;
    
    // แปลง Date เป็น String เพื่อให้ google.script.run ส่งค่ากลับไปได้
    var ts = oRow[0];
    if (ts instanceof Date) {
      ts = ts.toISOString();
    }
    
    var parsedItems = [];
    try {
      if (oRow[12]) parsedItems = JSON.parse(oRow[12]);
    } catch(e) {}
    
    var orderItems = parsedItems;
    
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
      items: orderItems,
      deliveryType: oRow[13] || 'ทันที',
      preorderTime: oRow[14] || '',
      shippingOption: oRow[15] || 'จัดส่ง'
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
           
           var staticQrUrl = "https://i.postimg.cc/zDFp1Dpk/Screenshot-10.png";
           messages.push({
             "type": "image",
             "originalContentUrl": staticQrUrl,
             "previewImageUrl": staticQrUrl
           });
        }
        else if (newStatus === "กำลังจัดส่ง" && paymentMethod === "โอนจ่าย") {
           messages.push({
             "type": "text",
             "text": "📦 แอดมินตรวจสอบยอดเงินเรียบร้อยแล้ว!\nขณะนี้ร้านกำลังเตรียมสินค้าและจัดส่งให้คุณสำหรับออเดอร์ " + orderId + "\nขอบคุณที่อุดหนุนครับ 😊"
           });
        }
        else if (newStatus === "ยืนยันแล้ว") {
           messages.push({
             "type": "text",
             "text": "🎉 ออเดอร์ " + orderId + " จัดส่งเรียบร้อยแล้ว!\nขอบคุณที่อุดหนุนร้านเกื้อกูลกันครับ 🥰"
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

function getAllMembersNative() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var membersSheet = ss.getSheetByName("Members");
  if (!membersSheet) return [];
  var mValues = membersSheet.getDataRange().getValues();
  var members = [];
  for (var m = mValues.length - 1; m >= 1; m--) {
    var mRow = mValues[m];
    if (!mRow[1]) continue;
    var mTs = mRow[0];
    if (mTs instanceof Date) mTs = mTs.toISOString();
    members.push({
      registeredAt: mTs,
      userId: mRow[1],
      displayName: mRow[2] || '',
      statusMessage: mRow[3] || '',
      email: mRow[4] || '',
      pictureUrl: mRow[5] || '',
      phone: mRow[6] ? mRow[6].toString().replace(/'/g, "") : '',
      gpsLocation: mRow[7] || '',
      addressDetails: mRow[8] || '',
      addressLabel: mRow[9] || ''
    });
  }
  return members;
}

