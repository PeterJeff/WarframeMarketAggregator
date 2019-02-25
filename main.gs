function onOpen() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var entries = [{
    name : "Manual Update",
    functionName : "RunUpdate"
  }];
  sheet.addMenu("Manual Actions", entries);
};



function RunUpdate() {
  Logger.log("Start update");
  var outputSheet = SpreadsheetApp.openById("170m5SxTD4hJr9KGEDHL0lDnJJzY8zDXenVqA28mECUY"); // Spreadsheet ID
  var sheet = getSheetById(1408954424); //Sheet ID
  var OutputNamesRef = GetNames();
  var offset = GetPriceData(OutputNamesRef);
  var outdata = OutputNamesRef.slice(offset, OutputNamesRef.length)
  WriteData(sheet,outdata, offset); 
}

//https://ctrlq.org/code/20016-maximum-execution-time-limit
function isTimeUp_(start) {

}



function WriteData(sheet, data, offset){
  //future problem if over 26 columns
  var rangestring = "A" + (2 + parseInt(offset)) +":" + String.fromCharCode(64 + data[0].length) + (parseInt(data.length)+1 + parseInt(offset));
  Logger.log("Writting data to range " + rangestring);
  SendLogData();
  var range = sheet.getRange(rangestring);
  range.setValues(data);
}


function GetPriceData(namedata){
  var cache = CacheService.getScriptCache();
  var lastindex = cache.get("lastindex");
  Logger.log("Begin Price data grab");
  var start = new Date();
  for(var z=lastindex; z<namedata.length; z++){
    //Logger.log("Grabbing prices for " + namedata[z][1]);
    //Logger.log("Total data: " + namedata[z].length);
    if(namedata[z].length > 2){
      Logger.log("Error on " + namedata[z][1] +": Too many data entires!");
      continue;
    }
    var prices = GetItemPrice(namedata[z][1]);
    //Logger.log("Total Prices: " + prices.length);
    var now = new Date();
    prices.push(now);
    namedata[z] = namedata[z].concat(prices);
    //Logger.log("Total data post concat: " + namedata[z].length);
    if (now.getTime() - start.getTime() > 300000) {// 5 minutes
      Logger.log("Time up");
      if(namedata.length == z){
        cache.put("lastindex", 0, 21600)
        Logger.log("Stopping at The End");
        return lastindex;
      }
      namedata.length = z;
      cache.put("lastindex", z, 21600)
      Logger.log("Stopping at: " + z);
      return lastindex;
    }
  }
  cache.put("lastindex", 0, 21600)
  Logger.log("Stopping at The End");
  return lastindex;
}

function ReturnPlatform(data,datatype){
  if(datatype == "pc"){
    return data.PC;
  }
  else if(datatype == "ps4"){
    return data.PS4;
  }
  else if(datatype == "xbox"){
    return data.XBox;
  }
  else if(datatype == "switch"){
    return data.Switch;
  }
}

function GetItemPrice(itemname){


  //code is not optimized but it works and the bottleneck is request limits from warframe market.
  // 4 sells, 4 buys
  Logger.log("Fetching prices for " +itemname);
  var prices = [];
  var response = UrlFetchApp.fetch("https://api.warframe.market/v1/items/" + itemname +"/orders");
  Utilities.sleep(200); // Need to investigate a better method for regulating fetch calls (limit 3 per second for WFM)
  var responseCode = response.getResponseCode()
  var responseBody = response.getContentText()
  if (responseCode != 200) {
    throw Utilities.formatString("Script request failed. Expected 200, got %d: %s", responseCode, responseBody)
  }
  var itemjson = JSON.parse(response.getContentText());
  var platformCount = 4;
  var data = {
    PC:{
      Buys:[],
      Sells:[],
      OverflowBuy:[],
      OverflowSell:[]
    },
    PS4:{
      Buys:[],
      Sells:[],
      OverflowBuy:[],
      OverflowSell:[]
    },
    XBox:{
      Buys:[],
      Sells:[],
      OverflowBuy:[],
      OverflowSell:[]
    },
    Switch:{
      Buys:[],
      Sells:[],
      OverflowBuy:[],
      OverflowSell:[]
    }
  };
  
  var x = itemjson.payload;
  for(i=0; i<itemjson.payload.orders.length; i++){
    var order = itemjson.payload.orders[i];
    if(order.region == "en"){
      var status = order.user.status.toString().toLowerCase();
      
      var platformdata = ReturnPlatform(data,order.platform);

      if(order.order_type == "sell"){
        if(status === "ingame" || status === "online" ){
          platformdata.Sells.push(order.platinum);
        }
        else{
          platformdata.OverflowSell.push(order.platinum);
        }
      }
      else if(order.order_type == "buy"){
        if(status === "ingame" || status === "online" ){
          platformdata.Buys.push(order.platinum);
        }
        else{
          platformdata.OverflowBuy.push(order.platinum);
        }
      }
    }
  }
  
 
  var averageMax = 3;
  for (platform in data){
    if (data.hasOwnProperty(platform)){
      var platformdata = data[platform];
      if(platformdata.Sells.length == 0){
        platformdata.Sells = platformdata.OverflowSell;
        platformdata.OverflowSell = [];
      }
      if(platformdata.Buys.length == 0){
        platformdata.Buys = platformdata.OverflowBuy;
        platformdata.OverflowBuy = [];
      }
      platformdata.Sells.sort(function(a, b){return a-b}) //sort ascending
      platformdata.Buys.sort(function(a, b){return b-a}) //sort descending
      delete platformdata.OverflowSell;
      delete platformdata.OverflowBuy;
      for (pricedata in platformdata){
        prices.push((platformdata[pricedata][0]  === undefined) ? 0 : platformdata[pricedata][0] );
        var price = 0;
        var averageAmount = 0;
        for(i=0; i<platformdata[pricedata].length && i<averageMax; i++){
          price += platformdata[pricedata][i];
          ++averageAmount;
        }
        if(averageAmount){
          price /=averageAmount;
        }
        prices.push(price);
      }
    }
  }
  
//  for (key in Sells){
//    if (Sells.hasOwnProperty(key)){
//      Sells[key].sort(function(a, b){return a-b}) //sort ascending
//      prices.push((Sells[key][0]  === undefined) ? 0 : Sells[key][0] );
//      var price = 0;
//      var averageAmount = 0;
//      for(i=0; i<Sells[key].length && i<averageMax; i++){
//        price += Sells[key][i];
//        ++averageAmount;
//      }
//      if(averageAmount){
//        price /=averageAmount;
//      }
//      prices.push(price);
//    }
//  };
//  
//  for ( key in Buys){
//    if (Buys.hasOwnProperty(key)){
//      Buys[key].sort(function(a, b){return b-a}) //sort descending
//      prices.push((Buys[key][0]  === undefined) ? 0 : Buys[key][0] );
//      var price = 0;
//      var averageAmount = 0;
//      for(i=0; i<Buys[key].length && i<averageMax; i++){
//        price += Buys[key][i]; 
//        ++averageAmount;
//      }
//      if(averageAmount){
//        price /=averageAmount;
//      }
//      prices.push(price);
//    }
//  };




  return prices;
}

function GetNames() {

  // cannot cache item name list, data too large, need to look into compression for other situations but this request count is irrelevant
  var json;
  var url = "https://api.warframe.market/v1/items";
  var response = UrlFetchApp.fetch(url);
  var responseCode = response.getResponseCode()
  var responseBody = response.getContentText()
  if (responseCode != 200) {
    throw Utilities.formatString("Script request failed. Expected 200, got %d: %s", responseCode, responseBody)
  }
  json = JSON.parse(response.getContentText());

  var itemCount = json.payload.items.en.length;
  var outputArray = [];
  for(i=0; i<itemCount; i++){
      outputArray.push([json.payload.items.en[i].item_name,json.payload.items.en[i].url_name]);
  }
  if(outputArray.itemCount !== 0)
    return outputArray;
  else
    throw "Script Failure - No Data In Output";
}


//https://stackoverflow.com/questions/26682269/get-google-sheet-by-id
function getSheetById(id) {
  return SpreadsheetApp.getActive().getSheets().filter(
    function(s) {return s.getSheetId() === id;}
  )[0];
}



function SendLogData(){
  var recipient = Session.getActiveUser().getEmail();
  var subject = 'Log Data';
  var body = Logger.getLog();
  MailApp.sendEmail(recipient, subject, body); 
}
