  // ==========================================
  // การตั้งค่า LINE Messaging API
  // ==========================================
  // 1. ใส่ Channel Access Token ของ LINE OA (Long-lived) 
  const LINE_ACCESS_TOKEN = 'UTqQBlXZsz1FHhyz3elJBbwW/Sy3ex26+xhkqy6OpjuUL6Y3gB1QYI3+CCwARapxDVxivd5Iw6TYL64IO0Kz0ykDLJ8qDJrSrDnQdrugEu14xp4MU7mClHJG03GszZzgnS9DHafrq38iKUNHtCyokQdB04t89/1O/w1cDnyilFU=';

  // 2. เบอร์ PromptPay ของร้านค้า
  const SHOP_PROMPTPAY_ID = '0957579454';
  // ==========================================

  // ล้าง Cache สินค้าอัตโนมัติเมื่อมีการแก้ไขชีต Catalog ใน Google Sheets
  // (ต้องตั้ง Trigger: Edit > Current project's triggers > Add Trigger > onEdit)
  function onEdit(e) {
    try {
      var sheetName = e.source.getActiveSheet().getName();
      if (sheetName === 'Catalog') {
        var cache = CacheService.getScriptCache();
        cache.remove('catalog_products_json');
        cache.remove('catalog_products_json_v2'); // ล้าง cache key ใหม่ด้วย
      }
    } catch(err) { }
  }

  // สร้าง JSON เพื่อใช้เป็น Static File บน Vercel (เรียกจากหน้า Admin)
  function exportProductsJson() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var catalogSheet = ss.getSheetByName("Catalog");
    if (!catalogSheet) return JSON.stringify({ status: 'error', message: 'ไม่พบชีต Catalog' });
    var values = catalogSheet.getDataRange().getValues();
    var products = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row[0] || String(row[0]).trim() === '') continue;
      if (String(row[7] || 'active').toLowerCase() === 'inactive') continue;
      products.push({
        id: String(row[0]).trim(),
        name: String(row[1] || ''),
        category: String(row[2] || ''),
        price: Number(row[3] || 0),
        desc: String(row[4] || ''),
        img: String(row[5] || ''),
        tag: String(row[6] || '')
      });
    }
    return JSON.stringify({ status: 'success', products: products, total: products.length, exportedAt: new Date().getTime() });
  }

  // ดึงข้อมูลสินค้าแบบ Native Object สำหรับเรียกผ่าน google.script.run จากหน้า Admin
  function getProductsNative() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var catalogSheet = ss.getSheetByName("Catalog");
    if (!catalogSheet) return [];
    var values = catalogSheet.getDataRange().getValues();
    var products = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row[0] && row[0] !== 0) continue;
      if (String(row[0]).trim() === '') continue;
      var status = String(row[7] || 'active').toLowerCase();
      if (status === 'inactive') continue;
      products.push({
        id: String(row[0] || '').trim(),
        name: String(row[1] || ''),
        category: String(row[2] || ''),
        price: Number(row[3] || 0),
        desc: String(row[4] || ''),
        img: String(row[5] || ''),
        tag: String(row[6] || '')
      });
    }
    return products;
  }

  function doPost(e) {
    try {
      var data = JSON.parse(e.postData.contents);
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      
      // ตรวจสอบว่าเป็น Webhook จาก LINE หรือไม่ (มีการส่ง events มา)
      if (data.events && Array.isArray(data.events)) {
        data.events.forEach(function(event) {
          // 1. ลูกค้าส่งรูปภาพสลิปโอนเงินเข้ามาใน LINE Chat
          if (event.type === 'message' && event.message && event.message.type === 'image') {
            handleLineSlipUpload(ss, event);
          }

          // 2. ลูกค้ากดปุ่มยืนยัน/ยกเลิกจาก Flex Message
          if (event.type === 'postback' && event.postback && event.postback.data) {
            var pbData = event.postback.data;
            // แปลง query string เป็น object (เช่น action=cancelOrder&orderId=ORD-123)
            var params = pbData.split('&').reduce(function(acc, curr) {
              var parts = curr.split('=');
              acc[parts[0]] = parts[1];
              return acc;
            }, {});
            
            if (params.action === 'cancelOrder' || params.action === 'confirmOrder') {
              var ordersSheet = ss.getSheetByName("Orders");
              var values = ordersSheet.getDataRange().getValues();
              var isProcessed = false;
              
              var userId = "";
              for (var i = 1; i < values.length; i++) {
                if (values[i][1] && values[i][1].toString() === params.orderId) {
                  var currentStatus = values[i][9] || "";
                  userId = values[i][2] || "";
                  // ถ้าสถานะไม่ใช่ "รอตรวจสอบ" หรือ "รอการยืนยัน" แสดงว่าออเดอร์นี้ถูกดำเนินการไปแล้ว (เช่น จัดส่งสำเร็จ) ให้บล็อคการกดปุ่มซ้ำ
                  if (currentStatus !== "รอตรวจสอบ" && currentStatus !== "รอการยืนยัน") {
                    isProcessed = true;
                  }
                  break;
                }
              }
              
              var cache = CacheService.getScriptCache();
              var cacheKey = "notify_dup_" + params.orderId + "_" + params.action;
              
              if (isProcessed) {
                // ตรวจสอบว่าเป็น Webhook Retry หรือไม่
                var isRetry = (event.deliveryContext && event.deliveryContext.isRedelivery);
                
                // ส่งข้อความแจ้งเตือนลูกค้าว่ากดซ้ำ เฉพาะกรณีที่ไม่ใช่ Retry และไม่ได้อยู่ในช่วงบล็อค
                if (!isRetry && !cache.get(cacheKey) && userId && userId !== 'unknown') {
                  var msg = (params.action === 'cancelOrder') 
                    ? "⚠️ ไม่สามารถยกเลิกได้: ออเดอร์ " + params.orderId + " ได้ดำเนินการไปแล้ว หรืออยู่ในขั้นตอนที่ไม่สามารถยกเลิกได้แล้วครับ" 
                    : "⚠️ ออเดอร์ " + params.orderId + " ได้รับการยืนยันและดำเนินการไปแล้วเรียบร้อยครับ ไม่จำเป็นต้องกดยืนยันซ้ำครับ";
                  
                  sendLinePushMessage(userId, [{
                    "type": "text",
                    "text": msg
                  }]);
                  cache.put(cacheKey, "sent", 300); // กันส่งซ้ำใน 5 นาที
                }
              } else {
                // เมื่อรับคำสั่งครั้งแรกสำเร็จ ให้ตั้ง Cache บล็อคข้อความเตือนไว้ 15 วินาที
                // เพื่อกันไม่ให้ LINE Webhook Retry (ที่มักเกิดใน 1-5 วินาที) ไปส่งข้อความเตือนผิดพลาดว่ากดซ้ำ
                cache.put(cacheKey, "sent", 15);
                
                var newStatus = (params.action === 'cancelOrder') ? 'ยกเลิก' : 'ชำระเงิน';
                updateOrderStatusNative(params.orderId, newStatus);
              }
            }
          }
        });
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // หากไม่ใช่ Webhook จาก LINE (เป็นการเรียก API จากหน้าเว็บ LIFF ตามปกติ)
      var action = data.action || 'register';
      
      if (action === 'createOrder') {
        return createOrderHandler(ss, data);
      } else if (action === 'updateOrderStatus') {
        return updateOrderStatusHandler(ss, data);
      } else if (action === 'updateOrderItems') {
        return updateOrderItemsHandler(ss, data);
      } else if (action === 'uploadSlip') {
        return uploadSlipHandler(ss, data);
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

  // Handler สำหรับรับการแนบสลิปผ่าน Web API (เช่น แอดมินแนบ หรือลูกค้าแนบผ่านหน้าเว็บ)
  function uploadSlipHandler(ss, data) {
    try {
      var orderId = data.orderId;
      var slipUrl = data.slipUrl || '';
      var base64Data = data.base64 || '';
      
      if (!orderId) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing orderId' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (base64Data) {
        var folderName = "Order_Slips";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        var cleanedBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        var decoded = Utilities.base64Decode(cleanedBase64);
        var blob = Utilities.newBlob(decoded, 'image/jpeg', 'slip_' + orderId + '_' + Date.now() + '.jpg');
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        slipUrl = "https://lh3.googleusercontent.com/d/" + file.getId();
      }

      if (!slipUrl) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No slip URL or file provided' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var ordersSheet = ss.getSheetByName("Orders");
      if (!ordersSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Orders sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var values = ordersSheet.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < values.length; i++) {
        if (values[i][1] && values[i][1].toString() === orderId) {
          ordersSheet.getRange(i + 1, 8).setValue(slipUrl);
          found = true;
          break;
        }
      }

      if (found) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', slipUrl: slipUrl }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Order not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ฟังก์ชันดาวน์โหลดรูปภาพสลิปที่ลูกค้าส่งมาในแชท LINE บันทึกลง Google Drive และผูกกับออเดอร์
  function handleLineSlipUpload(ss, event) {
    try {
      var userId = event.source ? event.source.userId : '';
      if (!userId || userId === 'unknown') return;

      var ordersSheet = ss.getSheetByName("Orders");
      if (!ordersSheet) return;

      var values = ordersSheet.getDataRange().getValues();
      var targetRow = -1;
      var targetOrderId = '';
      var targetCustomerName = '';

      // ค้นหาออเดอร์ของลูกค้ารายนี้ โดยเน้นออเดอร์ล่าสุดที่อยู่ในขั้นตอนชำระเงินหรือรอตรวจสอบ
      for (var r = values.length - 1; r >= 1; r--) {
        var rowUserId = values[r][2] ? values[r][2].toString().trim() : '';
        if (rowUserId === userId.trim()) {
          var st = values[r][9] ? values[r][9].toString().trim() : '';
          if (st === "ชำระเงิน" || st === "รอชำระเงิน" || st === "รอตรวจสอบ" || st === "กำลังตรวจสอบออเดอร์") {
            targetRow = r + 1; // 1-based row
            targetOrderId = values[r][1] ? values[r][1].toString() : '';
            targetCustomerName = values[r][3] ? values[r][3].toString() : '';
            break;
          }
        }
      }

      // ถ้าไม่มีออเดอร์ที่ค้างชำระ ให้เลือกออเดอร์ล่าสุดของลูกค้า (ตราบใดที่ไม่ใช่ยกเลิก)
      if (targetRow === -1) {
        for (var r = values.length - 1; r >= 1; r--) {
          var rowUserId = values[r][2] ? values[r][2].toString().trim() : '';
          if (rowUserId === userId.trim()) {
            var st = values[r][9] ? values[r][9].toString().trim() : '';
            if (st !== "ยกเลิก") {
              targetRow = r + 1;
              targetOrderId = values[r][1] ? values[r][1].toString() : '';
              targetCustomerName = values[r][3] ? values[r][3].toString() : '';
              break;
            }
          }
        }
      }

      // ดาวน์โหลดรูปภาพสลิปจาก LINE Message Content API
      var messageId = event.message.id;
      var contentUrl = "https://api-data.line.me/v2/bot/message/" + messageId + "/content";
      var res = UrlFetchApp.fetch(contentUrl, {
        headers: { "Authorization": "Bearer " + LINE_ACCESS_TOKEN },
        muteHttpExceptions: true
      });

      if (res.getResponseCode() !== 200) {
        Logger.log("Failed to download image from LINE: " + res.getResponseCode());
        return;
      }

      var blob = res.getBlob();
      var contentType = blob.getContentType() || 'image/jpeg';
      var ext = (contentType.indexOf('png') !== -1) ? 'png' : 'jpg';

      // บันทึกลงโฟลเดอร์ Google Drive "Order_Slips"
      var folderName = "Order_Slips";
      var folders = DriveApp.getFoldersByName(folderName);
      var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      var fileName = "slip_" + (targetOrderId || userId) + "_" + (new Date().getTime()) + "." + ext;
      blob.setName(fileName);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var fileId = file.getId();
      var slipUrl = "https://lh3.googleusercontent.com/d/" + fileId;

      if (targetRow !== -1) {
        // บันทึกลงคอลัมน์ H (คอลัมน์ที่ 8: Slip Image URL)
        ordersSheet.getRange(targetRow, 8).setValue(slipUrl);

        // อัปเดตสถานะเป็น "ชำระเงิน"
        var currentSt = values[targetRow - 1][9] ? values[targetRow - 1][9].toString().trim() : '';
        if (currentSt === "รอชำระเงิน" || currentSt === "รอตรวจสอบ" || currentSt === "กำลังตรวจสอบออเดอร์") {
          ordersSheet.getRange(targetRow, 10).setValue("ชำระเงิน");
        }

        // ตอบกลับลูกค้าด้วย Flex Message แจ้งยืนยันการรับสลิป
        if (event.replyToken) {
          sendLineReplyMessage(event.replyToken, [
            {
              "type": "flex",
              "altText": "🧾 ได้รับสลิปโอนเงินเรียบร้อยแล้ว (" + targetOrderId + ")",
              "contents": {
                "type": "bubble",
                "header": {
                  "type": "box",
                  "layout": "vertical",
                  "backgroundColor": "#16a34a",
                  "paddingAll": "16px",
                  "contents": [
                    {
                      "type": "text",
                      "text": "🧾 ได้รับสลิปโอนเงินแล้ว",
                      "color": "#ffffff",
                      "weight": "bold",
                      "size": "md"
                    },
                    {
                      "type": "text",
                      "text": "เลขออเดอร์: " + targetOrderId,
                      "color": "#ffffff",
                      "size": "xs",
                      "margin": "xs"
                    }
                  ]
                },
                "body": {
                  "type": "box",
                  "layout": "vertical",
                  "spacing": "sm",
                  "contents": [
                    {
                      "type": "text",
                      "text": "ขอบคุณครับ! ระบบบันทึกสลิปโอนเงินของท่านแล้ว ✨",
                      "size": "sm",
                      "weight": "bold",
                      "color": "#0f172a"
                    },
                    {
                      "type": "text",
                      "text": "แอดมินกำลังตรวจสอบยอดเงินและจัดเตรียมออเดอร์ให้ทันทีครับ รอรับของอร่อยได้เลย! 🧑‍🍳🛵",
                      "size": "xs",
                      "wrap": true,
                      "color": "#64748b"
                    }
                  ]
                }
              }
            }
          ]);
        }
      } else {
        if (event.replyToken) {
          sendLineReplyMessage(event.replyToken, [
            {
              "type": "text",
              "text": "ได้รับรูปภาพสลิปเรียบร้อยแล้วครับ! หากต้องการระบุเลขออเดอร์ สามารถพิมพ์เลขออเดอร์ (เช่น ORD-...) ส่งมาในแชทนี้ได้เลยนะครับ แอดมินจะตรวจสอบและบันทึกให้ครับ 🙏"
            }
          ]);
        }
      }
    } catch(err) {
      Logger.log("handleLineSlipUpload error: " + err.message);
    }
  }

  // ส่งข้อความตอบกลับ LINE (Reply Message)
  function sendLineReplyMessage(replyToken, messages) {
    if (!replyToken || !LINE_ACCESS_TOKEN || LINE_ACCESS_TOKEN === 'YOUR_LINE_ACCESS_TOKEN_HERE') return;
    var url = 'https://api.line.me/v2/bot/message/reply';
    var payload = {
      'replyToken': replyToken,
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
      return UrlFetchApp.fetch(url, options).getContentText();
    } catch(e) {
      Logger.log("sendLineReplyMessage error: " + e.message);
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
    var name = "-";
    var phone = "-";
    var deliveryType = "ทันที";
    var preorderTime = "";
    var shippingOption = "จัดส่ง";
    var paymentMethod = "-";

    for (var i = 1; i < values.length; i++) {
      if (values[i][1] && values[i][1].toString() === orderId) {
        foundRow = i + 1;
        userId = values[i][2];
        name = values[i][3] || "-";
        phone = values[i][4] || "-";
        deliveryType = values[i][13] || "ทันที";
        preorderTime = values[i][14] || "";
        shippingOption = values[i][15] || "จัดส่ง";
        paymentMethod = values[i][10] || "-";
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
    
    // เปลี่ยนสถานะเป็น "รอการยืนยัน" เมื่อแอดมินแก้ไขออเดอร์
    ordersSheet.getRange(foundRow, 10).setValue("รอการยืนยัน");
    
    var notifyDebug = "Skipped notification";
    
    // ส่งข้อความแจ้งเตือนหาลูกค้าผ่าน LINE เมื่อมีการแก้ไขรายการสินค้า/ราคา
    if (notifyCustomer !== false && userId && userId !== 'unknown' && userId !== 'web-test-user' && LINE_ACCESS_TOKEN !== 'YOUR_LINE_ACCESS_TOKEN_HERE') {
      try {
        var bodyText = "ทางร้านได้อัปเดตราคาสินค้า/จำนวนเรียบร้อยแล้วครับ";
        if (changeNote && changeNote.trim() !== '') {
          bodyText += " (หมายเหตุ: " + changeNote.trim() + ")";
        }
        
        var flexMsg = buildStatusFlexMessage(
          "✏️ แจ้งปรับเปลี่ยนออเดอร์", 
          orderId, 
          bodyText, 
          "#0f766e", // Teal Color
          name, 
          phone, 
          shippingOption, 
          deliveryType, 
          preorderTime, 
          JSON.stringify(newItems), 
          newTotalPrice,
          paymentMethod
        );
        
        var messagePayload = [
          flexMsg,
          {
            "type": "template",
            "altText": "กรุณายืนยันการเปลี่ยนแปลงออเดอร์",
            "template": {
              "type": "buttons",
              "text": "คุณลูกค้ายืนยันรับออเดอร์ที่แก้ไขนี้หรือไม่ครับ?",
              "actions": [
                {
                  "type": "postback",
                  "label": "✅ ยืนยันรายการสั่งซื้อ",
                  "data": "action=confirmOrder&orderId=" + orderId,
                  "displayText": "ลูกค้ายืนยันรับออเดอร์ที่แก้ไขนี้ครับ"
                },
                {
                  "type": "postback",
                  "label": "❌ ยกเลิกคำสั่งซื้อ",
                  "data": "action=cancelOrder&orderId=" + orderId,
                  "displayText": "ลูกค้าขอยกเลิกออเดอร์นี้ครับ"
                }
              ]
            }
          }
        ];
        
        notifyDebug = sendLinePushMessage(userId, messagePayload);
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
      
      var slipFormula = data.slipUrl || "";
      
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
      var action = (e && e.parameter) ? e.parameter.action : null;
      
      // Action 0: แสดงหน้าเว็บ Admin Dashboard (รองรับทั้งเปิดลิงก์ตรงๆ และ ?action=admin)
      if (action === 'admin' || !action) {
        var htmlOutput = null;
        var filenames = ['admin', 'index'];
        for (var i = 0; i < filenames.length; i++) {
          try {
            htmlOutput = HtmlService.createHtmlOutputFromFile(filenames[i]);
            if (htmlOutput) break;
          } catch (err) {}
        }
        if (htmlOutput) {
          return htmlOutput
            .setTitle('Admin Dashboard - จัดการคำสั่งซื้อและสินค้า')
            .addMetaTag('viewport', 'width=device-width, initial-scale=1')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }
      }

      // Action: ลูกค้ายกเลิกออเดอร์ผ่านลิงก์ LINE
      if (action === 'cancelOrder') {
        var orderId = e.parameter.orderId;
        if (orderId) updateOrderStatusNative(orderId, 'ยกเลิก');
        var html = '<div style="text-align:center; padding:50px; font-family:sans-serif;">' +
                  '<h1 style="color:#ef4444;">❌ ยกเลิกออเดอร์แล้ว</h1>' +
                  '<p>ระบบได้ยกเลิกออเดอร์ <b>' + orderId + '</b> เรียบร้อยแล้วครับ</p>' +
                  '<p style="color:#666; font-size:14px; margin-top:30px;">คุณสามารถปิดหน้านี้เพื่อกลับไปที่แชทได้เลยครับ</p>' +
                  '</div>';
        return HtmlService.createHtmlOutput(html).addMetaTag('viewport', 'width=device-width, initial-scale=1');
      }
      
      // Action: ลูกค้ายืนยันออเดอร์ผ่านลิงก์ LINE
      if (action === 'confirmOrder') {
        var orderId = e.parameter.orderId;
        if (orderId) updateOrderStatusNative(orderId, 'ชำระเงิน');
        var html = '<div style="text-align:center; padding:50px; font-family:sans-serif;">' +
                  '<h1 style="color:#22c55e;">✅ ยืนยันสำเร็จ</h1>' +
                  '<p>ระบบได้เข้าสู่ขั้นตอนแจ้งชำระเงินสำหรับออเดอร์ <b>' + orderId + '</b> เรียบร้อยแล้วครับ</p>' +
                  '<p style="color:#666; font-size:14px; margin-top:30px;">คุณสามารถปิดหน้านี้เพื่อกลับไปที่แชท และดู QR Code ชำระเงินได้เลยครับ</p>' +
                  '</div>';
        return HtmlService.createHtmlOutput(html).addMetaTag('viewport', 'width=device-width, initial-scale=1');
      }
      
      // Action: ล้าง Cache สินค้า (เรียกจากหน้า Admin หลังอัปเดตสินค้าใน Google Sheets)
      if (action === 'clearProductCache') {
        var cache = CacheService.getScriptCache();
        cache.remove('catalog_products_json');
        return ContentService.createTextOutput(JSON.stringify({ 
          status: 'success', 
          message: 'ล้าง Cache สินค้าเรียบร้อย ลูกค้าจะเห็นข้อมูลใหม่ทันที' 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Action 1: ดึงข้อมูลสินค้าจากชีต Catalog
      if (action === 'getProducts') {
        // ใช้ CacheService เพื่อเร่งความเร็ว — ข้อมูลสินค้าจะถูกเก็บไว้ในแคช 60 วินาที
        var cache = CacheService.getScriptCache();
        var cachedProducts = cache.get('catalog_products_json_v2');
        
        if (cachedProducts) {
          return ContentService.createTextOutput(cachedProducts).setMimeType(ContentService.MimeType.JSON);
        }
        
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
          if (String(row[0]).trim() === '') continue; // ข้ามแถวที่ A ว่าง
          
          products.push({
            id: String(row[0] || '').trim(),
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
        
        var jsonOutput = JSON.stringify({ 
          status: 'success', 
          products: activeProducts,
          total: activeProducts.length,
          cachedAt: new Date().getTime()
        });
        
        // เก็บไว้ในแคช 60 วินาที — สินค้าใหม่จะปรากฏภายใน 1 นาทีหลังเพิ่มลงชีต
        try {
          cache.put('catalog_products_json_v2', jsonOutput, 60);
        } catch(e) {
          // ถ้าข้อมูลใหญ่เกินไปสำหรับ cache ก็ไม่เป็นไร ส่งข้อมูลกลับเลย
        }
        
        return ContentService.createTextOutput(jsonOutput).setMimeType(ContentService.MimeType.JSON);
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
          
          var slipVal = oRow[7] ? oRow[7].toString().trim() : '';
          var slipForm = (fRow && fRow[7]) ? fRow[7].toString().trim() : '';
          var finalSlip = slipVal;
          if (slipForm && slipForm.indexOf('HYPERLINK') !== -1) {
            var sMatch = slipForm.match(/HYPERLINK\(\s*"([^"]+)"/i);
            if (sMatch && sMatch[1]) finalSlip = sMatch[1];
          }
          
          orders.push({
            timestamp: oRow[0],
            orderId: oRow[1],
            userId: oRow[2],
            customerName: oRow[3],
            phone: oRow[4],
            gpsLocation: finalGps,
            addressDetails: oRow[6],
            slipUrl: finalSlip,
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
    try {
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
        
        var slipVal = safeString(oRow[7]);
        var slipForm = safeString(fRow[7]);
        var finalSlip = slipVal;
        if (slipForm && slipForm.indexOf('HYPERLINK') !== -1) {
          var sMatch = slipForm.match(/HYPERLINK\(\s*"([^"]+)"/i);
          if (sMatch && sMatch[1]) finalSlip = sMatch[1];
        }
        
        orders.push({
          timestamp: ts,
          orderId: safeString(oRow[1]),
          userId: safeString(oRow[2]),
          customerName: safeString(oRow[3]),
          phone: safeString(oRow[4]).replace(/'/g, ""),
          gpsLocation: finalGps,
          addressDetails: safeString(oRow[6]),
          slipUrl: finalSlip,
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
    } catch(err) {
      Logger.log("getAllOrdersNative error: " + err.message);
      return [];
    }
  }
  function updateOrderStatusNative(orderId, newStatus) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(1500); // Wait up to 1.5 seconds max
    } catch (e) {
      return { status: 'error', message: 'System busy, please try again.' };
    }
    
    try {
      var cache = CacheService.getScriptCache();
      var cacheKey = "order_" + orderId + "_status";
      var cachedStatus = cache.get(cacheKey);
      
      // หากพบว่ามีการแจ้งเตือนสถานะนี้ไปแล้วในแคชช่วง 2 นาทีที่ผ่านมา ให้ข้ามทันที
      if (cachedStatus === newStatus) {
        return { status: 'success', debug: 'Status already ' + newStatus + ' (cached)' };
      }
      
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
          userId = values[i][2];
          name = values[i][3];
          phone = values[i][4];
          totalPrice = values[i][8] || 0;
          paymentMethod = values[i][10] || "ปลายทาง";
          itemsJson = values[i][12] || "[]";
          deliveryType = values[i][13] || "ทันที";
          preorderTime = values[i][14] || "";
          shippingOption = values[i][15] || "จัดส่ง";
          break;
        }
      }
      
      if (foundRow !== -1) {
        // ป้องกันการแจ้งเตือนซ้ำ: ตรวจสอบว่าสถานะปัจจุบันตรงกับที่กำลังจะเปลี่ยนหรือไม่
        var existingStatus = values[foundRow - 1][9] || "";
        if (existingStatus === newStatus) {
          cache.put(cacheKey, newStatus, 120); // จำไว้ 2 นาที
          return { status: 'success', debug: 'Status already ' + newStatus };
        }
        
        ordersSheet.getRange(foundRow, 10).setValue(newStatus);
        cache.put(cacheKey, newStatus, 120); // จำสถานะล่าสุดไว้ 2 นาที

      
      // ส่งข้อความแจ้งเตือนผ่าน LINE ทันทีที่มีการเปลี่ยนสถานะ
      if (userId && userId !== 'unknown' && userId !== 'web-test-user' && LINE_ACCESS_TOKEN !== 'YOUR_LINE_ACCESS_TOKEN_HERE') {
        try {
          var messages = [];
          
          if ((newStatus === "ชำระเงิน" || newStatus === "รอชำระเงิน") && (paymentMethod.indexOf("โอน") > -1 || paymentMethod.indexOf("บัญชีธนาคาร") > -1 || paymentMethod.indexOf("ผสม") > -1)) {
            messages.push(buildStatusFlexMessage("💳 ยืนยันออเดอร์ & แจ้งชำระเงิน", orderId, "แอดมินยืนยันออเดอร์แล้วครับ คุณลูกค้าสามารถโอนเงินตาม QR Code ด้านล่างนี้ แล้วแนบสลิปมาได้เลยครับ ✨", "#2563eb", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice, paymentMethod));
            
            // สร้าง QR Code PromptPay แบบ Dynamic ตามยอดเงินที่ต้องโอนจริง
            var qrAmount = Number(totalPrice || 0);
            
            // ตรวจสอบหากเป็น "โอนเงินผสมเงินสด" เพื่อดึงเฉพาะยอดโอนมาสร้าง QR Code
            if (paymentMethod && paymentMethod.indexOf("โอนเงินผสมเงินสด") > -1) {
              var match = paymentMethod.match(/- โอน (\d+(?:\.\d+)?) บาท/);
              if (match && match[1]) {
                qrAmount = Number(match[1]);
              }
            }
            
            var dynamicQrUrl = "https://promptpay.io/" + SHOP_PROMPTPAY_ID + "/" + qrAmount + ".png";
            messages.push({
              "type": "image",
              "originalContentUrl": dynamicQrUrl,
              "previewImageUrl": dynamicQrUrl
            });

            // ส่งปุ่ม Quick Reply ให้ลูกค้ากดแนบสลิปได้ทันทีจากอัลบั้มหรือกล้อง
            messages.push({
              "type": "text",
              "text": "💡 เมื่อโอนเงินเรียบร้อยแล้ว สามารถกดปุ่มด้านล่างนี้เพื่อเลือกรูปสลิปจากอัลบั้ม หรือถ่ายรูปส่งกลับมาในแชทนี้ได้ทันทีครับ ระบบจะบันทึกสลิปให้อัตโนมัติครับ 👇",
              "quickReply": {
                "items": [
                  {
                    "type": "action",
                    "action": {
                      "type": "cameraRoll",
                      "label": "📸 แนบสลิปจากอัลบั้ม"
                    }
                  },
                  {
                    "type": "action",
                    "action": {
                      "type": "camera",
                      "label": "📷 ถ่ายรูปสลิป"
                    }
                  }
                ]
              }
            });
          }
          else if (newStatus === "กำลังจัดเตรียมสินค้า" || newStatus === "เตรียมออเดอร์" || newStatus === "จัดเตรียมสินค้าพร้อมส่ง") {
            messages.push(buildStatusFlexMessage("📦 กำลังจัดเตรียมสินค้า", orderId, "แอดมินกำลังจัดเตรียมออเดอร์ให้คุณลูกค้าอย่างตั้งใจครับ รอรับความอร่อยได้เลย! 🧑‍🍳✨", "#f59e0b", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice, paymentMethod));
          }
          else if (newStatus === "กำลังจัดส่ง") {
            messages.push(buildStatusFlexMessage("🚚 สินค้าอยู่ระหว่างจัดส่ง", orderId, "พี่ไรเดอร์กำลังนำสินค้าส่งตรงไปถึงคุณลูกค้าแล้วครับ! ขอบคุณที่อุดหนุนครับ 😊🛵", "#8b5cf6", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice, paymentMethod));
          }
          else if (newStatus === "จัดส่งสำเร็จ" || newStatus === "ยืนยันแล้ว") {
            messages.push(buildStatusFlexMessage("🎉 จัดส่งสินค้าสำเร็จเรียบร้อย", orderId, "สินค้าถึงมือคุณลูกค้าเรียบร้อยแล้ว ทานให้อร่อยนะค้าบ! ขอบคุณที่อุดหนุนร้านเกื้อกูลกันครับ 🥰❤️", "#16a34a", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice, paymentMethod));
          }
          else if (newStatus === "ยกเลิก") {
            messages.push(buildStatusFlexMessage("🥺 แจ้งยกเลิกออเดอร์", orderId, "ทางร้านจำเป็นต้องขออนุญาตยกเลิกออเดอร์นี้ชั่วคราวครับ 🙏❤️ ต้องขออภัยในความไม่สะดวกเป็นอย่างยิ่งเลยนะครับ หวังว่าจะได้รับโอกาสดูแลคุณลูกค้าใหม่ในโอกาสหน้านะครับ 🥰✨", "#dc2626", name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice, paymentMethod));
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
    } else {
      return { status: 'error', message: 'ไม่พบออเดอร์' };
    }
  } finally {
    lock.releaseLock();
  }
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
  function buildStatusFlexMessage(title, orderId, bodyText, headerBgColor, name, phone, shippingOption, deliveryType, preorderTime, itemsJson, totalPrice, paymentMethod = "-") {
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
                },
                {
                  "type": "box",
                  "layout": "horizontal",
                  "contents": [
                    { "type": "text", "text": "💳 ชำระเงินโดย :", "size": "xs", "color": "#64748b", "flex": 2 },
                    { "type": "text", "text": paymentMethod || "-", "size": "xs", "color": "#0f172a", "weight": "bold", "flex": 4, "wrap": true }
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

  // ==========================================
  // เมนูและฟังก์ชัน Sync ข้อมูลคำสั่งซื้อและสมาชิกจาก Google Sheets ไป Cloudflare D1
  // ==========================================
  function onOpen() {
    try {
      SpreadsheetApp.getUi()
        .createMenu('⚡ ระบบเกื้อกูลกัน')
        .addItem('🔄 ซิงค์ข้อมูลทั้งหมดไป Cloudflare D1 (ออเดอร์ + สมาชิก)', 'syncAllDataToCloudflare')
        .addToUi();
    } catch(e) {}
  }

  function syncAllDataToCloudflare() {
    var ui = null;
    try { ui = SpreadsheetApp.getUi(); } catch(e) {}
    
    var cfApiUrl = 'https://kuekoonkan-api.noperfecf.workers.dev';
    var orders = getAllOrdersNative();
    var members = getAllMembersNative();
    
    Logger.log("🚀 เริ่มต้นซิงค์ข้อมูลไปยัง Cloudflare D1...");
    Logger.log("📊 พบคำสั่งซื้อทั้งหมด: " + orders.length + " รายการ | สมาชิก: " + members.length + " คน");
    
    var ordersSuccess = 0;
    var membersSuccess = 0;

    // 1. ซิงค์ Orders (แบ่งส่งเป็น Batch ทีละ 50 รายการ)
    if (orders && orders.length > 0) {
      var chunkSize = 50;
      for (var i = 0; i < orders.length; i += chunkSize) {
        var chunk = orders.slice(i, i + chunkSize);
        try {
          var res = UrlFetchApp.fetch(cfApiUrl, {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify({
              action: 'syncOrdersBatch',
              orders: chunk
            }),
            muteHttpExceptions: true
          });
          var resCode = res.getResponseCode();
          if (resCode >= 200 && resCode < 300) {
            ordersSuccess += chunk.length;
          } else {
            // Fallback: หาก endpoint batch ยังไม่พร้อม ให้ส่งทีละรายการ
            for (var j = 0; j < chunk.length; j++) {
              try {
                var singleRes = UrlFetchApp.fetch(cfApiUrl, {
                  method: 'post',
                  contentType: 'application/json',
                  payload: JSON.stringify(Object.assign({ action: 'createOrder' }, chunk[j])),
                  muteHttpExceptions: true
                });
                if (singleRes.getResponseCode() < 300) ordersSuccess++;
              } catch(errSingle) {}
            }
          }
        } catch(err) {
          Logger.log("Order batch sync error: " + err.message);
        }
      }
    }

    // 2. ซิงค์ Members (แบ่งส่งเป็น Batch ทีละ 50 คน)
    if (members && members.length > 0) {
      var mChunkSize = 50;
      for (var m = 0; m < members.length; m += mChunkSize) {
        var mChunk = members.slice(m, m + mChunkSize);
        try {
          var mRes = UrlFetchApp.fetch(cfApiUrl, {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify({
              action: 'syncMembersBatch',
              members: mChunk
            }),
            muteHttpExceptions: true
          });
          var mResCode = mRes.getResponseCode();
          if (mResCode >= 200 && mResCode < 300) {
            membersSuccess += mChunk.length;
          } else {
            // Fallback: ส่งทีละคน
            for (var k = 0; k < mChunk.length; k++) {
              try {
                var singleMRes = UrlFetchApp.fetch(cfApiUrl, {
                  method: 'post',
                  contentType: 'application/json',
                  payload: JSON.stringify(Object.assign({ action: 'register' }, mChunk[k])),
                  muteHttpExceptions: true
                });
                if (singleMRes.getResponseCode() < 300) membersSuccess++;
              } catch(errM) {}
            }
          }
        } catch(mErr) {
          Logger.log("Member batch sync error: " + mErr.message);
        }
      }
    }

    var resultMsg = "✅ ซิงค์ข้อมูลสำเร็จเรียบร้อยแล้ว!\n\n" +
                    "📦 คำสั่งซื้อ (Orders): " + ordersSuccess + " / " + orders.length + " รายการ\n" +
                    "👥 สมาชิก (Members): " + membersSuccess + " / " + members.length + " คน\n\n" +
                    "ข้อมูลทั้งหมดถูกอัปเดตเข้าสู่ฐานข้อมูล Cloudflare D1 เรียบร้อยแล้วครับ!";
    Logger.log(resultMsg);
    if (ui) {
      ui.alert('ผลการซิงค์ข้อมูลสู่ Cloudflare D1', resultMsg, ui.ButtonSet.OK);
    }
    return {
      status: 'success',
      ordersSynced: ordersSuccess,
      totalOrders: orders.length,
      membersSynced: membersSuccess,
      totalMembers: members.length
    };
  }
