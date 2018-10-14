/*
 *
 *
 *       Complete the API routing below
 *
 *
 */

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
var fetch = require('node-fetch');
var bluebird = require('bluebird');
var Promise = require('bluebird');

const DATABASE = process.env.DB;

module.exports = function (app) {


  app.route('/api/stock-prices')
    .get(function (req, res) {

      // Get query, query type and likes.
      let stock = req.query.stock;
      let likes = req.query.like || false;
      let isArray = Array.isArray(req.query.stock);

      // Get IP address to validate 1 like on a stock per IP
      var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      ip = ip.split(',')[0];


      if (!isArray ? singleStock() : doubleStock());

      let objectsArray = [];

      function singleStock() {


        fetch(`https://api.iextrading.com/1.0/stock/${stock}/price`, {
            method: 'GET',
            mode: 'no-cors'
          })
          .then(response => {
            return response.json();
          })
          .then(result => {

            let obj = {
              stock: stock.toUpperCase(),
              price: result.toString(),
              likes: (likes ? 1 : -1),
              rellikes: 0
            }
            objectsArray.push(obj);
            Mongo(1);

          })
          .catch(error => {
            console.log(error);
            return res.send('Could not complete your request.');
          })
      }

      function doubleStock() {

        fetch(`https://api.iextrading.com/1.0/stock/market/batch?symbols=${stock[0]},${stock[1]}&types=price`, {
            method: 'GET',
            mode: 'no-cors'
          })
          .then(response => {
            return response.json();
          })
          .then(result => {

            let stock1 = stock[0].toUpperCase();
            let stock2 = stock[1].toUpperCase();

            let obj1 = {
              stock: stock1,
              price: result[stock1].price.toString(),
              likes: (likes ? 1 : -1),
              rellikes: 0
            }
            objectsArray.push(obj1);

            let obj2 = {
              stock: stock2,
              price: result[stock2].price.toString(),
              likes: (likes ? 1 : -1),
              rellikes: 0
            }
            objectsArray.push(obj2);

            Mongo(2);
          })
          // Catch ERROR
          .catch(error => {
            console.log(error);
            return res.send('Could not complete your request.');
          })

      }

      function Mongo(num) {
        objectsArray.forEach((item, i) => {
          // Connect to Mongo
          MongoClient.connect(DATABASE, (err, database) => {
            if (err) console.log(err);
            let db = database.collection('stocks');

            db.findOne({
              ticker: item.stock
            }, (err, docs) => {
              if (err) console.log(err);

              // If if doesnt exist create
              if (docs === null) {
                console.log('Inserting New Entry');
                db.insertOne({
                  ticker: item.stock,
                  likes: (likes ? [ip] : []),
                  numlikes: 0
                }, (err, doc) => {
                  if (err) console.log(err);
                })
              }
              // If it does exist - update it
              else {


                let update = true;

                // If already liked dont update
                docs.likes.map(user => {
                  if (user == ip) {
                    objectsArray[i].likes = 1;
                    update = false;
                  }
                });
                objectsArray[i].rellikes = docs.numlikes;


                // If need to update and liked
                if (likes && update) {
                  db.findOneAndUpdate({
                    ticker: item.stock
                  }, {
                    $push: {
                      likes: ip
                    },
                    $inc: {
                      numlikes: 1
                    }
                  }, (err, doc) => {
                    if (err) console.log(err);
                    objectsArray[i].likes = 1;
                    objectsArray[i].rellikes = doc.numlikes;
                  })
                }
              }


              if (num == 1) {
                Respond();
              }
              if (num == 2 && i == 1) {
                Respond();
              }

              database.close();
            }) // End findOne
          }) // End Mongo.Connect
        }) // End forEach
      }

      function Respond() {
        if (objectsArray.length == 1) {
          return res.json({
            stockData: {
              stock: objectsArray[0].stock,
              price: objectsArray[0].price,
              likes: objectsArray[0].likes
            }
          })
        } else {

          return res.json({
            stockData: [{
                stock: objectsArray[0].stock,
                price: objectsArray[0].price,
                rel_likes: objectsArray[0].rellikes - objectsArray[1].rellikes,
              },
              {
                stock: objectsArray[1].stock,
                price: objectsArray[1].price,
                rel_likes: objectsArray[1].rellikes - objectsArray[0].rellikes,
              }
            ]
          })
        }
      }
    }) // End GET

};