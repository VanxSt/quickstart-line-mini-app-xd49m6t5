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
    } else if (action === 'updateOrderItems') {
      return updateOrderItemsHandler(ss, data);
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

// Handler สำหรับแก้ไขรายการสินค้าในออเดอร์ (ปรับจำนวน/ราคา/ลบรายการ และแจ้งเตือนลูกค้า)
function updateOrderItemsHandler(ss, data) {
  try {
    var orderId = data.orderId;
    var newItems = data.items || [];
    var newTotalPrice = Number(data.totalPrice || 0);
    var notifyCustomer = data.notifyCustomer !== false;
    var changeNote = data.changeNote || data.note || '';
    
    var result = updateOrderItemsNative(orderId, newItems, newTotalPrice, notifyCustomer, changeNote);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ฟังก์ชันหลักสำหรับแก้ไขรายการสินค้า พร้อมส่ง LINE Notification หาผู้ซื้อ
function updateOrderItemsNative(orderId, newItems, newTotalPrice, notifyCustomer, changeNote) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName("Orders");
  if (!ordersSheet) {
    return { status: 'error', message: 'ไม่พบชีต Orders' };
  }
  
  var values = ordersSheet.getDataRange().getValues();
  var foundRow = -1;
  var userId = "";
  for (var i = 1; i < values.length; i++) {
    if (values[i][1] && values[i][1].toString() === orderId) {
      foundRow = i + 1;
      userId = values[i][2];
      break;
    }
  }
  
  if (foundRow === -1) {
    return { status: 'error', message: 'ไม่พบออเดอร์: ' + orderId };
  }
  
  // สร้างข้อความรายการสินค้าให้อ่านง่าย
  var itemsText = (newItems || []).map(function(item) {
    return item.name + " x" + item.qty;
  }).join(", ");
  
  // อัปเดต 3 คอลัมน์: Total Price (col 9), Order Items Text (col 12), Items JSON (col 13)
  ordersSheet.getRange(foundRow, 9).setValue(newTotalPrice);            // Total Price
  ordersSheet.getRange(foundRow, 12).setValue(itemsText);               // Order Items (readable)
  ordersSheet.getRange(foundRow, 13).setValue(JSON.stringify(newItems)); // Items JSON
  
  var notifyDebug = "Skipped notification";
  
  // ส่งข้อความแจ้งเตือนหาลูกค้าผ่าน LINE เมื่อมีการแก้ไขรายการสินค้า/ราคา
  if (notifyCustomer !== false && userId && userId !== 'unknown' && userId !== 'web-test-user' && LINE_ACCESS_TOKEN !== 'YOUR_LINE_ACCESS_TOKEN_HERE') {
    try {
      var msgText = "✏️ มีการปรับเปลี่ยนรายการสินค้าในออเดอร์ " + orderId + "\n" +
                    "ทางร้านได้อัปเดตราคาสินค้า/จำนวนเรียบร้อยแล้วครับ\n\n" +
                    "📋 รายการสินค้าล่าสุด:\n";
      
      (newItems || []).forEach(function(item) {
        var p = Number(item.price || 0);
        var q = Number(item.qty || 1);
        var sub = Number(item.subtotal || (p * q));
        msgText += "• " + (item.name || 'สินค้า') + " x" + q + " (฿" + sub.toLocaleString() + ")\n";
      });
      
      msgText += "\n💰 ยอดสุทธิใหม่: ฿" + newTotalPrice.toLocaleString();
      
      if (changeNote && changeNote.trim() !== '') {
        msgText += "\n📌 หมายเหตุ: " + changeNote.trim();
      }
      
      msgText += "\n\nหากมีข้อสงสัย ทักแชทสอบถามแอดมินได้เลยครับ 😊";
      
      notifyDebug = sendLinePushMessage(userId, [{ "type": "text", "text": msgText }]);
    } catch(e) {
      notifyDebug = 'Notification Error: ' + e.message;
    }
  }
  
  return { status: 'success', message: 'อัปเดตรายการสินค้าและแจ้งลูกค้าสำเร็จ', debug: notifyDebug };
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
    
    var note = data.note ? data.note.toString().trim() : '';
    
    // ดึงหรือสร้างชีต "Orders"
    var ordersHeaders = ["Timestamp", "Order ID", "User ID", "Name", "Phone", "GPS Location", "Address Details", "Slip Image URL", "Total Price", "Status", "Payment Method", "Order Items", "Items JSON", "Delivery Type", "Preorder Time", "Shipping Option", "Note"];
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

    if (note) {
      displayAddress += "\n📝 หมายเหตุ: " + note;
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
      shippingOption,
      note
    ]);
    
    // อัปเดตข้อมูลเบอร์โทร และที่อยู่ล่าสุดในชีต Members ทันทีที่มีออเดอร์ใหม่
    if (userId && userId !== 'unknown' && userId !== 'web-test-user') {
      try {
        var membersSheet = ss.getSheetByName("Members") || ss.getSheets()[0];
        if (membersSheet) {
          // ตรวจสอบและสร้างหัวข้อตารางคอลัมน์ H ของชีต Members ถ้ายังไม่มี
          if (membersSheet.getLastColumn() < 8 || !membersSheet.getRange(1, 8).getValue()) {
            membersSheet.getRange(1, 8).setValue("Saved Addresses JSON");
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
              // คอลัมน์ 8 (H) = Saved Addresses JSON (เก็บสูงสุด 5 ที่อยู่)
              var savedAddressesStr = membersSheet.getRange(mRow, 8).getValue() || "[]";
              var savedAddresses = [];
              try {
                savedAddresses = JSON.parse(savedAddressesStr);
              } catch(e) {
                // หากข้อมูลเก่าในช่อง H ไม่ใช่ JSON (เช่น เป็นลิงก์ Google Maps) ให้ลองสร้างเป็นรายการแรกแทน
                if (savedAddressesStr && savedAddressesStr.toString().indexOf("http") === 0) {
                  savedAddresses = [{
                    label: 'ที่อยู่เก่า',
                    gpsLocation: savedAddressesStr.toString(),
                    addressDetails: ''
                  }];
                } else {
                  savedAddresses = [];
                }
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
              
              membersSheet.getRange(mRow, 8).setValue(JSON.stringify(savedAddresses));
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
          var orderItems = [];
          try {
            if (row[12]) orderItems = JSON.parse(row[12]);
          } catch(e) {}
          
          myOrders.push({
            timestamp: row[0],
            orderId: row[1],
            totalPrice: row[8],
            status: row[9] || 'รอตรวจสอบ',
            items: orderItems
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
      var orderFormulas = ordersSheet.getDataRange().getFormulas();
      var orders = [];
      
      // วนลูปจากใหม่ไปเก่า (ล่างสุดไปบนสุด)
      for (var k = orderValues.length - 1; k >= 1; k--) {
        var oRow = orderValues[k];
        var fRow = (orderFormulas && orderFormulas[k]) ? orderFormulas[k] : [];
        if (!oRow[1]) continue; // ข้ามแถวว่าง
        
        var parsedItems = [];
        try {
          if (oRow[12]) parsedItems = JSON.parse(oRow[12]);
        } catch(e) {}
        
        var orderItems = parsedItems;
        var gpsVal = oRow[5] ? oRow[5].toString() : '';
        var gpsForm = fRow[5] ? fRow[5].toString() : '';
        var finalGps = (gpsForm && gpsForm.indexOf('HYPERLINK') !== -1) ? gpsForm : gpsVal;
        
        orders.push({
          timestamp: oRow[0],
          orderId: oRow[1],
          userId: oRow[2],
          customerName: oRow[3],
          phone: oRow[4],
          gpsLocation: finalGps,
          addressDetails: oRow[6],
          totalPrice: oRow[8],
          status: oRow[9] || 'รอตรวจสอบ',
          paymentMethod: oRow[10] || 'ปลายทาง',
          items: orderItems,
          deliveryType: oRow[13] || 'ทันที',
          preorderTime: oRow[14] || '',
          shippingOption: oRow[15] || 'จัดส่ง',
          note: oRow[16] || ''
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
        var savedAddressesStr = mRow[7] || '[]';
        var gpsLoc = '';
        var addrDetails = '';
        var addrLabel = '';
        var parsed = [];
        try {
          parsed = JSON.parse(savedAddressesStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            gpsLoc = parsed[0].gpsLocation || '';
            addrDetails = parsed[0].addressDetails || '';
            addrLabel = parsed[0].label || '';
          } else if (savedAddressesStr && savedAddressesStr.toString().indexOf("http") === 0) {
            gpsLoc = savedAddressesStr.toString();
          }
        } catch(e) {
          if (savedAddressesStr && savedAddressesStr.toString().indexOf("http") === 0) {
            gpsLoc = savedAddressesStr.toString();
          }
        }

        members.push({
          registeredAt: mTs,
          userId: mRow[1],
          displayName: mRow[2] || '',
          statusMessage: mRow[3] || '',
          email: mRow[4] || '',
          pictureUrl: mRow[5] || '',
          phone: mRow[6] ? mRow[6].toString().replace(/'/g, "") : '',
          gpsLocation: gpsLoc,
          addressDetails: addrDetails,
          addressLabel: addrLabel,
          savedAddresses: Array.isArray(parsed) ? savedAddressesStr : JSON.stringify([{
            label: addrLabel || 'ที่อยู่ของฉัน',
            gpsLocation: gpsLoc,
            addressDetails: addrDetails
          }])
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
        var savedAddressesStr = values[i][7] || '[]';
        var gpsLoc = '';
        var addrDetails = '';
        var addrLabel = '';
        var parsed = [];
        try {
          parsed = JSON.parse(savedAddressesStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            gpsLoc = parsed[0].gpsLocation || '';
            addrDetails = parsed[0].addressDetails || '';
            addrLabel = parsed[0].label || '';
          } else if (savedAddressesStr && savedAddressesStr.toString().indexOf("http") === 0) {
            gpsLoc = savedAddressesStr.toString();
          }
        } catch(e) {
          if (savedAddressesStr && savedAddressesStr.toString().indexOf("http") === 0) {
            gpsLoc = savedAddressesStr.toString();
          }
        }

        var userData = {
          status: 'success',
          found: true,
          userId: values[i][1],
          displayName: values[i][2],
          statusMessage: values[i][3],
          email: values[i][4],
          pictureUrl: values[i][5],
          phone: values[i][6],
          gpsLocation: gpsLoc,
          addressDetails: addrDetails,
          addressLabel: addrLabel,
          savedAddresses: Array.isArray(parsed) ? savedAddressesStr : JSON.stringify([{
            label: addrLabel || 'ที่อยู่ของฉัน',
            gpsLocation: gpsLoc,
            addressDetails: addrDetails
          }])
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

// Helper: Safe stringifier to prevent google.script.run serialization failure (e.g. Unhandled Date objects)
function safeString(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd HH:mm:ss");
  return val.toString();
}

// ==========================================
// ฟังก์ชันสำหรับเรียกใช้ตรงจากหน้า admin.html (google.script.run)
// ==========================================
function getAllOrdersNative() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName("Orders");
  
  if (!ordersSheet) return [];
  
  var orderValues = ordersSheet.getDataRange().getValues();
  var orderFormulas = ordersSheet.getDataRange().getFormulas();
  var orders = [];
  
  for (var k = orderValues.length - 1; k >= 1; k--) {
    var oRow = orderValues[k];
    var fRow = (orderFormulas && orderFormulas[k]) ? orderFormulas[k] : [];
    if (!oRow[1]) continue;
    
    var ts = safeString(oRow[0]);
    var parsedItems = [];
    try {
      if (oRow[12]) parsedItems = JSON.parse(oRow[12]);
    } catch(e) {}
    
    var gpsVal = safeString(oRow[5]);
    var gpsForm = safeString(fRow[5]);
    var finalGps = (gpsForm && gpsForm.indexOf('HYPERLINK') !== -1) ? gpsForm : gpsVal;
    
    orders.push({
      timestamp: ts,
      orderId: safeString(oRow[1]),
      userId: safeString(oRow[2]),
      customerName: safeString(oRow[3]),
      phone: safeString(oRow[4]).replace(/'/g, ""),
      gpsLocation: finalGps,
      addressDetails: safeString(oRow[6]),
      totalPrice: Number(oRow[8] || 0),
      status: safeString(oRow[9] || 'รอตรวจสอบ'),
      paymentMethod: safeString(oRow[10] || 'ไม่ระบุ'),
      items: parsedItems,
      deliveryType: safeString(oRow[13] || 'ทันที'),
      preorderTime: safeString(oRow[14]),
      shippingOption: safeString(oRow[15] || 'จัดส่ง'),
      note: safeString(oRow[16] || '')
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
  
  var name = "-";
  var phone = "-";
  var itemsJson = "[]";
  var deliveryType = "ทันที";
  var preorderTime = "";
  var shippingOption = "จัดส่ง";
  
  for (var i = 1; i < values.length; i++) {
    if (values[i][1] && values[i][1].toString() === orderId) {
      foundRow = i + 1;
      userId = values[i][2]; // User ID
      name = values[i][3]; // Name
      phone = values[i][4]; // Phone
      totalPrice = values[i][8] || 0; // Total Price
      paymentMethod = values[i][10] || "ปลายทาง"; // Payment Method
      itemsJson = values[i][12] || "[]"; // Items JSON
      deliveryType = values[i][13] || "ทันที"; // Delivery Type
      preorderTime = values[i][14] || ""; // Preorder Time
      shippingOption = values[i][15] || "จัดส่ง"; // Shipping Option
      break;
    }
  }
  
  if (foundRow !== -1) {
    ordersSheet.getRange(foundRow, 10).setValue(newStatus);
    
    // ส่งข้อความแจ้งเตือนผ่าน LINE ทันทีที่มีการเปลี่ยนสถานะ
    if (userId && userId !== 'unknown' && userId !== 'web-test-user' && LINE_ACCESS_TOKEN !== 'YOUR_LINE_ACCESS_TOKEN_HERE') {
      try {
        var messages = [];
        
        if ((newStatus === "ชำระเงิน" || newStatus === "รอชำระเงิน") && (paymentMethod === "โอนจ่าย" || paymentMethod === "โอนเงินผ่านบัญชีธนาคาร" || paymentMethod === "โอนเงินผสมเงินสด")) {
           messages.push(buildStatusFlexMessage("💳 ยืนยันออเดอร์ & แจ้งชำระเงิน", orderId, "แอดมินยืนยันออเดอร์แล้วครับ คุณลูกค้าสามารถโอนเงินตาม QR Code ด้านล่างนี้ แล้วแนบสลิปมาได้เลยครับ ✨", "#2563eb", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice));
           
           // สร้าง QR Code PromptPay แบบ Dynamic ตามยอดเงินจริง
           // รูปแบบ URL: https://promptpay.io/{เบอร์หรือเลขบัตร}/{จำนวนเงิน}.png
           var qrAmount = Number(totalPrice || 0);
           var dynamicQrUrl = "https://promptpay.io/" + SHOP_PROMPTPAY_ID + "/" + qrAmount + ".png";
           messages.push({
             "type": "image",
             "originalContentUrl": dynamicQrUrl,
             "previewImageUrl": dynamicQrUrl
           });
        }
        else if (newStatus === "เตรียมออเดอร์") {
           messages.push(buildStatusFlexMessage("📦 กำลังจัดเตรียมสินค้า", orderId, "ทางร้านกำลังเตรียมสินค้าของคุณอย่างพิถีพิถันครับ อดใจรออีกสักครู่นะครับ! 📦✨", "#d97706", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice));
        }
        else if (newStatus === "เตรียมจัดส่ง") {
           messages.push(buildStatusFlexMessage("🛍️ จัดเตรียมสินค้าพร้อมส่ง", orderId, "สินค้าแพ็คเสร็จเรียบร้อยแล้ว พร้อมส่งมอบให้ไรเดอร์แล้วครับ! 📦💨", "#0284c7", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice));
        }
        else if (newStatus === "กำลังจัดส่ง") {
           messages.push(buildStatusFlexMessage("🚚 สินค้าอยู่ระหว่างจัดส่ง", orderId, "พี่ไรเดอร์กำลังนำสินค้าส่งตรงไปถึงคุณลูกค้าแล้วครับ! ขอบคุณที่อุดหนุนครับ 😊🛵", "#8b5cf6", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice));
        }
        else if (newStatus === "จัดส่งสำเร็จ" || newStatus === "ยืนยันแล้ว") {
           messages.push(buildStatusFlexMessage("🎉 จัดส่งสินค้าสำเร็จเรียบร้อย", orderId, "สินค้าถึงมือคุณลูกค้าเรียบร้อยแล้ว ทานให้อร่อยนะค้าบ! ขอบคุณที่อุดหนุนร้านเกื้อกูลกันครับ 🥰❤️", "#16a34a", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice));
        }
        else if (newStatus === "ยกเลิก") {
           messages.push(buildStatusFlexMessage("🥺 แจ้งยกเลิกออเดอร์", orderId, "ทางร้านจำเป็นต้องขออนุญาตยกเลิกออเดอร์นี้ชั่วคราวครับ 🙏❤️ ต้องขออภัยในความไม่สะดวกเป็นอย่างยิ่งเลยนะครับ หวังว่าจะได้รับโอกาสดูแลคุณลูกค้าใหม่ในโอกาสหน้านะครับ 🥰✨", "#dc2626", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice));
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
    var mTs = safeString(mRow[0]);
    var savedAddressesStr = safeString(mRow[7] || '[]');
    var gpsLoc = '';
    var addrDetails = '';
    var addrLabel = '';
    var parsed = [];
    try {
      parsed = JSON.parse(savedAddressesStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        gpsLoc = safeString(parsed[0].gpsLocation);
        addrDetails = safeString(parsed[0].addressDetails);
        addrLabel = safeString(parsed[0].label);
      } else if (savedAddressesStr && savedAddressesStr.indexOf("http") === 0) {
        gpsLoc = savedAddressesStr;
      }
    } catch(e) {
      if (savedAddressesStr && savedAddressesStr.indexOf("http") === 0) {
        gpsLoc = savedAddressesStr;
      }
    }

    members.push({
      registeredAt: mTs,
      userId: safeString(mRow[1]),
      displayName: safeString(mRow[2]),
      statusMessage: safeString(mRow[3]),
      email: safeString(mRow[4]),
      pictureUrl: safeString(mRow[5]),
      phone: safeString(mRow[6]).replace(/'/g, ""),
      gpsLocation: gpsLoc,
      addressDetails: addrDetails,
      addressLabel: addrLabel,
      savedAddresses: Array.isArray(parsed) ? savedAddressesStr : JSON.stringify([{
        label: addrLabel || 'ที่อยู่ของฉัน',
        gpsLocation: gpsLoc,
        addressDetails: addrDetails
      }])
    });
  }
  return members;
}

// สร้าง Flex Message สำหรับการแจ้งเตือนเปลี่ยนสถานะออเดอร์ (เต็มรูปแบบ)
function buildStatusFlexMessage(title, orderId, bodyText, headerBgColor, name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice) {
  var cartItems = [];
  try {
    cartItems = JSON.parse(itemsJson);
  } catch(e) {}
  
  var calcSubtotal = 0;
  var itemBoxes = [];
  
  cartItems.forEach(function(item) {
    var itemPrice = Number(item.price || 0);
    var itemQty = Number(item.qty || 1);
    var itemTotal = itemPrice * itemQty;
    calcSubtotal += itemTotal;
    
    itemBoxes.push({
      "type": "box",
      "layout": "horizontal",
      "margin": "md",
      "spacing": "md",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": String(item.name || 'สินค้า'),
              "size": "sm",
              "wrap": true,
              "weight": "bold",
              "color": "#1e293b"
            },
            {
              "type": "box",
              "layout": "horizontal",
              "margin": "xs",
              "contents": [
                {
                  "type": "text",
                  "text": "x" + itemQty + "  •  ฿" + itemPrice.toLocaleString(),
                  "size": "xs",
                  "color": "#64748b",
                  "flex": 3
                },
                {
                  "type": "text",
                  "text": "฿" + itemTotal.toLocaleString(),
                  "size": "xs",
                  "weight": "bold",
                  "color": "#0f172a",
                  "align": "end",
                  "flex": 2
                }
              ]
            }
          ]
        }
      ]
    });
  });
  
  var calcShippingFee = Number(totalPrice) - calcSubtotal;
  if (calcShippingFee < 0) calcShippingFee = 0;
  
  var deliveryText = (shippingOption === 'รับหน้าร้าน') ? "🏪 รับสินค้าเองที่หน้าร้าน" : "🚚 จัดส่งตามที่อยู่";
  var timeText = (deliveryType === 'ล่วงหน้า') ? "🕒 สั่งล่วงหน้า (" + preorderTime + " น.)" : "🚀 ส่งทันที (ด่วนที่สุด)";
  
  return {
    "type": "flex",
    "altText": title + " (" + orderId + ")",
    "contents": {
      "type": "bubble",
      "header": {
        "type": "box",
        "layout": "vertical",
        "backgroundColor": headerBgColor || "#2563eb",
        "paddingAll": "16px",
        "contents": [
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": title,
                "weight": "bold",
                "size": "xl",
                "color": "#ffffff",
                "wrap": true,
                "flex": 4
              }
            ]
          },
          {
            "type": "text",
            "text": "เลขที่: " + orderId,
            "size": "xs",
            "color": "#ffffff",
            "margin": "xs"
          }
        ]
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "lg",
        "spacing": "md",
        "contents": [
          {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#f8fafc",
            "cornerRadius": "md",
            "paddingAll": "md",
            "spacing": "xs",
            "contents": [
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  { "type": "text", "text": "👤 ผู้รับ", "size": "xs", "color": "#64748b", "flex": 2 },
                  { "type": "text", "text": String(name || '-'), "size": "xs", "color": "#0f172a", "weight": "bold", "flex": 4 }
                ]
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  { "type": "text", "text": "📞 เบอร์ติดต่อ", "size": "xs", "color": "#64748b", "flex": 2 },
                  { "type": "text", "text": String(phone || '-'), "size": "xs", "color": "#0f172a", "weight": "bold", "flex": 4 }
                ]
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  { "type": "text", "text": "🚚 การรับสินค้า", "size": "xs", "color": "#64748b", "flex": 2 },
                  { "type": "text", "text": deliveryText, "size": "xs", "color": "#059669", "weight": "bold", "flex": 4 }
                ]
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  { "type": "text", "text": "🕒 เวลาจัดส่ง/รับ", "size": "xs", "color": "#64748b", "flex": 2 },
                  { "type": "text", "text": timeText, "size": "xs", "color": "#dc2626", "weight": "bold", "flex": 4, "wrap": true }
                ]
              }
            ]
          },
          { "type": "separator", "margin": "md" },
          {
            "type": "text",
            "text": "📦 รายการสินค้าที่สั่งซื้อ",
            "weight": "bold",
            "size": "sm",
            "color": "#334155",
            "margin": "sm"
          }
        ].concat(itemBoxes).concat([
          { "type": "separator", "margin": "md" },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              { "type": "text", "text": "รวมค่าสินค้า", "size": "sm", "color": "#64748b", "flex": 3 },
              { "type": "text", "text": "฿" + calcSubtotal.toLocaleString(), "size": "sm", "color": "#0f172a", "align": "end", "flex": 3 }
            ]
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              { "type": "text", "text": "ค่าจัดส่ง", "size": "sm", "color": "#64748b", "flex": 3 },
              { "type": "text", "text": calcShippingFee > 0 ? "฿" + calcShippingFee.toLocaleString() : "ฟรี (฿0)", "size": "sm", "color": calcShippingFee > 0 ? "#0f172a" : "#16a34a", "weight": "bold", "align": "end", "flex": 3 }
            ]
          },
          { "type": "separator", "margin": "sm" },
          {
            "type": "box",
            "layout": "horizontal",
            "margin": "md",
            "contents": [
              { "type": "text", "text": "ยอดเงินรวมสุทธิ", "size": "md", "color": "#0f172a", "weight": "bold", "flex": 3 },
              { "type": "text", "text": "฿" + Number(totalPrice).toLocaleString(), "size": "xl", "color": "#10b981", "weight": "bold", "align": "end", "flex": 3 }
            ]
          }
        ])
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "backgroundColor": "#f8fafc",
        "paddingAll": "12px",
        "contents": [
          {
            "type": "text",
            "text": "✨ " + bodyText,
            "size": "xs",
            "color": "#64748b",
            "wrap": true,
            "align": "center"
          }
        ]
      }
    }
  };
}

