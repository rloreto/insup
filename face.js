const faceKey1 = '82716f7bbf084fc8b1df6891ef861b25';
const faceKey2 = '7089281f34724490a5358f5bf7b52dbf';
const endpoint = 'https://westeurope.api.cognitive.microsoft.com/face/v1.0';
var Promise = require('bluebird');
var fs = require('fs');
var request = require('request');
var getDirName = require('path').dirname;
var getFileName = require('path').name
var path = require('path');
var request = require('request');


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

var getFaceInfo= (imageUrl) => {
    var promise = new Promise(function(resolve) {
        if(imageUrl){
            request({
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key':  faceKey1
                },
                uri: 'https://eastus.api.cognitive.microsoft.com/face/v1.0/detect?returnFaceId=true&returnFaceLandmarks=false&returnFaceAttributes=age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,occlusion,accessories,blur,exposure,noise',
                body: '{"url": ' + '"' + imageUrl + '"}',
                method: 'POST'
              }, function (err, res, body) {
                  if(err){
                      resolve(err);
                  } else {
                     
                     var data = JSON.parse(body);
                     if(data && data.length>0) {
                         resolve(data[0].faceAttributes);
                     } else {
                         resolve();
                     }
                  }
             
            });
        } else {
            resolve();
        }

    })

    return promise;
}

module.exports = {  getFaceInfo };
