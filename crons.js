var Firebase = require('firebase');
//var request = require('request');
var CronJob = require('cron').CronJob
var request = require('sync-request');


var ref = new Firebase("https://pricedropalert.firebaseio.com/");


var j = 0;
new CronJob('0 */1 * * * *', function () {
    console.log("cron : " + j);
    j++;


    var date = new Date();
    var month = date.getMonth() + 1;
    var fdate = date.getFullYear() + ", " + month + ", " + date.getDate() + ", " + date.getHours() + ", " + date.getMinutes() + ", " + date.getSeconds() + ", " + date.getMilliseconds();

    ref.child("products").once("value", function (snapshot) {
        snapshot.forEach(function (childsnap) {
            var data = childsnap.val();


            if (data.provider == "snapdeal") {
                /*
                 var headers = {
                 'snapdeal-Affiliate-Id': "84198",
                 'snapdeal-Token-Id': "37dee4a4f049497bda82168d62045b",
                 'Accept': "application/json"
                 };
                 var option = {
                 url: "http://affiliate-feeds.snapdeal.com/feed/product?id=" + data.pid,
                 method: "GET",
                 headers: headers
                 };
                 request(option, function (error, response, body) {
                 var pdata = JSON.parse(body);
                 updateData(pdata, data);
                 });
                 */
                var res = request('GET', "http://affiliate-feeds.snapdeal.com/feed/product?id=" + data.pid, {
                    'headers': {
                        'snapdeal-Affiliate-Id': "84198",
                        'snapdeal-Token-Id': "37dee4a4f049497bda82168d62045b",
                        'Accept': "application/json"
                    }
                });
                var pdata = JSON.parse(res.getBody())
                updateData(pdata, data);
            }
            else if (data.provider == "flipkart") {
                
                var res = request('GET', "https://affiliate-api.flipkart.net/affiliate/product/json?id=" + data.pid, {
                    'headers': {
                        "Fk-Affiliate-Id": "skycoresa",
                        "Fk-Affiliate-Token": "8bc5ee22862e442d9f6266200d58d92d"
                    }
                });
                if (res.getBody() != undefined) {
                    var tedata = JSON.parse(res.getBody());

                    var pprice = tedata.productBaseInfo.productAttributes.sellingPrice.amount;

                    var t = tedata.productBaseInfo.productAttributes.imageUrls;
                    var imageurl;
                    var te = JSON.stringify(t);
                    var te1 = te.split(",");
                    var te2 = te1[te1.length - 1].replace(" ", "");
                    var te3 = te2.replace("}", "");
                    var te4 = te3.replace(/\"/g, "");
                    var te5 = te4.split(":");
                    imageurl = te5[1] + ":" + te5[2];


                    var avail;
                    if (tedata.productBaseInfo.productAttributes.inStock)
                        avail = "in stock";
                    else
                        avail = "out of stock";
                    pdata = {
                        'id': tedata.productBaseInfo.productIdentifier.productId,
                        'title': tedata.productBaseInfo.productAttributes.title,
                        'brand': tedata.productBaseInfo.productAttributes.productBrand,
                        'availability': avail,
                        'link': tedata.productBaseInfo.productAttributes.productUrl,
                        'imageLink': imageurl,
                        'effectivePrice': pprice
                    };
                    updateData(pdata, data);
                }
                

            }

            function updateData(pdata, data) {
                if (pdata.availability != data.current_state) {

                    var temp;
                    ref.child('products').child(data.provider + "-" + data.pid).once('value', function (snapshot) {
                        if (snapshot.child('state_change_date').exists()) {
                            console.log("1");
                            var str = snapshot.child('state_change_date').val();
                            var str1 = snapshot.child('state_change_type').val();
                            str[str.length] = fdate;
                            str1[str1.length] = pdata.availability;
                            ref.child('products').child(data.provider + "-" + data.pid).update({
                                current_state: pdata.availability
                            });
                            ref.child('products').child(data.provider + "-" + data.pid).child('state_change_date').set(str);
                            ref.child('products').child(data.provider + "-" + data.pid).child('state_change_type').set(str1);
                        }
                        else {
                            console.log("2");
                            temp = fdate;
                            ref.child('products').child(data.provider + "-" + data.pid).update({
                                current_state: pdata.availability,
                                state_change_date: [
                                    temp
                                ],
                                state_change_type: [
                                    pdata.availability
                                ]
                            });
                        }
                    });


                }


                if (pdata.effectivePrice != data.current_price) {

                    ref.child('products').child(data.provider + "-" + data.pid).once('value', function (snapshot) {
                        if (snapshot.child('price_change_date').exists()) {
                            console.log("3");
                            var str = snapshot.child('price_change_date').val();
                            var str1 = snapshot.child('price_change_value').val();
                            str[str.length] = fdate;
                            str1[str1.length] = pdata.effectivePrice;
                            ref.child('products').child(data.provider + "-" + data.pid).update({
                                current_price: pdata.effectivePrice
                            });
                            ref.child('products').child(data.provider + "-" + data.pid).child('price_change_date').set(str);
                            ref.child('products').child(data.provider + "-" + data.pid).child('price_change_value').set(str1);
                        }
                        else {
                            console.log("4");
                            temp = fdate;
                            ref.child('products').child(data.provider + "-" + data.pid).update({
                                current_price: pdata.effectivePrice,
                                price_change_date: [
                                    temp
                                ],
                                price_change_value: [
                                    pdata.effectivePrice
                                ]
                            });
                        }
                    });

                }
            }

        });
    });
}, null, true, 'Asia/Kolkata');