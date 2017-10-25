const faceKey1 = '82716f7bbf084fc8b1df6891ef861b25';
const faceKey2 = '7089281f34724490a5358f5bf7b52dbf';
const endpoint = 'https://westeurope.api.cognitive.microsoft.com/face/v1.0';
var Promise = require('bluebird');
var oxford = require('project-oxford');
var fs = require('fs');
var getDirName = require('path').dirname;
var getFileName = require('path').name
var path = require('path');
var Promise = require('bluebird');
var querystring = require('querystring');
var http = require('http');

var http = require('http'),                                                
Stream = require('stream').Transform,                                  
fs = require('fs');                                                    
var url ='https://scontent-mad1-1.cdninstagram.com/t51.2885-19/s150x150/18382535_1934149056827282_1886815580225273856_a.jpg';
var request = require('request');


postCode = (url) => {

    request({
        headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key':  faceKey1
        },
        uri: 'https://eastus.api.cognitive.microsoft.com/face/v1.0/detect?returnFaceId=true&returnFaceLandmarks=false&returnFaceAttributes=age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,occlusion,accessories,blur,exposure,noise',
        body: '{"url": ' + '"' + url + '"}',
        method: 'POST'
      }, function (err, res, body) {
        debugger;
      });
  }

  postCode(url);

  return;
var downloadFile = (url) => {
    
        var promise = new Promise(function(resolve) {
            var tempFolder = './tmp';
            var fileName =path.basename(url);
            http.request(url, function(response) {                                        
                var data = new Stream();                                                    
            
                response.on('data', function(chunk) {                                       
                    data.push(chunk);                                                         
                });                                                                         
            
                response.on('end', function() {     
                    var filePath = tempFolder+ '/'+ fileName;
                    if (!fs.existsSync(tempFolder)){
                        fs.mkdirSync(tempFolder);
                    }
                    if(fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    fs.writeFileSync(filePath, data.read());  
                    resolve();                     
                                                
                });                                                                         
            }).end();
        });
    
        return promise;
    
    }



downloadFile(url).then(()=>{

    var client = new oxford.Client(faceKey1);
    debugger;    
    var fileName =path.basename(url);
    fileName = 'face1.jpg'
    client.face.detect({
        path: './tmp/' + fileName,
        analyzesAge: true,
        analyzesGender: true
    }).then(function (response) {
        debugger;
        console.log('The age is: ' + response[0].faceAttributes.age);
        console.log('The gender is: ' + response[0].faceAttributes.gender);
    }).catch(function(e){
        debugger;;
        console.log(e);
    });
});



return;

