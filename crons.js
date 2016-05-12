var Firebase = require('firebase');
var req = require('request');
var CronJob = require('cron').CronJob
var request = require('sync-request');


var ref = new Firebase("https://pricedropalert.firebaseio.com/");

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds){
            break;
        }
    }
}


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
                sleep(1000);
                var res = request('GET', "http://affiliate-feeds.snapdeal.com/feed/product?id=" + data.pid, {
                    'headers': {
                        'snapdeal-Affiliate-Id': "84198",
                        'snapdeal-Token-Id': "37dee4a4f049497bda82168d62045b",
                        'Accept': "application/json"
                    }
                });
                var pdata = JSON.parse(res.getBody());

                updateData(pdata, data);
            }
            else if (data.provider == "flipkart") {
                sleep(1000);
                try {
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
                }catch (error){
                    console.log(error);
                }


            }

            function updateData(pdata, data) {
                if (pdata.availability != data.current_state) {


                    ref.child('users').once('value', function (snapshot) {
                        snapshot.forEach(function (childsnap) {
                            var user = childsnap.val();
                            if(childsnap.child('notiflist').exists()) {


                                for (var i = 0; i < user.notiflist.length; i++) {
                                    if (user.notiflist[i] == data.provider + "-" + data.pid) {
                                        console.log(user.email + " :: " + user.firstname);

                                        var headers = {
                                            'Content-Type': 'application/json'
                                        };

                                        var dataString = '{"value1":"' + user.email + '","value2": "' + user.firstname + '" , "value3" :"' + data.title + ', status has changed to :' + pdata.availability + '"}';

                                        var options = {
                                            url: 'https://maker.ifttt.com/trigger/product_status_change/with/key/kPFezeNcht_mGMYW4ld-Hw2ZRtj-nudTZrjXJFXbg2w',
                                            method: 'POST',
                                            headers: headers,
                                            body: dataString
                                        };

                                        function callback(error, response, body) {
                                            if (!error && response.statusCode == 200) {
                                                console.log(body);
                                                ref.child('global').once('value', function (snapshot) {
                                                    var k = snapshot.child('no_of_alerts').val();
                                                    if (k == null || k == undefined) {
                                                        k = 1;
                                                    }
                                                    else {
                                                        k++;
                                                    }
                                                    ref.child('global').update({
                                                        'no_of_alerts': k
                                                    });

                                                });
                                            }
                                            else {
                                                console.log(error);
                                            }
                                        }

                                        req(options, callback);


                                    }
                                   
                                }

                            }

                        });
                    });

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

                    if (pdata.effectivePrice < data.current_price) {
                        ref.child('users').once('value', function (snapshot) {
                            snapshot.forEach(function (childsnap) {
                                var user = childsnap.val();
                                if(childsnap.child('notiflist').exists()) {


                                    for (var i = 0; i < user.notiflist.length; i++) {
                                        if (user.notiflist[i] == data.provider + "-" + data.pid) {
                                            console.log(user.email + " :: " + user.firstname);

                                            var headers = {
                                                'Content-Type': 'application/json'
                                            };

                                            var dataString = '{"value1":"' + user.email + '","value2": "' + user.firstname + '" , "value3" :"' + data.title + ', price has droped to :' + pdata.effectivePrice + '"}';

                                            var options = {
                                                url: 'https://maker.ifttt.com/trigger/price_drop/with/key/kPFezeNcht_mGMYW4ld-Hw2ZRtj-nudTZrjXJFXbg2w',
                                                method: 'POST',
                                                headers: headers,
                                                body: dataString
                                            };

                                            function callback(error, response, body) {
                                                if (!error && response.statusCode == 200) {
                                                    console.log(body);
                                                    ref.child('global').once('value', function (snapshot) {
                                                        var k = snapshot.child('no_of_alerts').val();
                                                        if (k == null || k == undefined) {
                                                            k = 1;
                                                        }
                                                        else {
                                                            k++;
                                                        }
                                                        

                                                        ref.child('global').update({
                                                            'no_of_alerts': k
                                                        });

                                                    });
                                                }
                                                else {
                                                    console.log(error);
                                                }
                                            }

                                            req(options, callback);

                                            

                                        }
                                    }

                                }
                            });
                        });
                    }

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


            var i = 0;
            var str = [];
            snapshot.forEach(function (childsnap) {
                i++;
                var x = childsnap.val();
                str[i] = x.provider + "-" + x.pid;
                ref.child('global').update({
                    'no_of_products': i,
                    'list_products' : str
                });

            });

        });
    });

    ref.child('users').once('value', function (snapshot) {
        var i = 0;
        snapshot.forEach(function (childsnap) {
            i++;

            ref.child('global').update({
                'no_of_user': i
            });

        });

    });
/*
    ref.child('products').once('value', function (snapshot) {
        var i = 0;
        var str = [];
        snapshot.forEach(function (childsnap) {
            i++;
            var x = childsnap.val();
            str[i] = x.provider + "-" + x.pid;
            ref.child('global').update({
                'no_of_products': i,
                'list_products' : str
            });

        });

    });

*/
}, null, true, 'Asia/Kolkata');