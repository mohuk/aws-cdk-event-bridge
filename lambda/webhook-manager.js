const AWS = require('aws-sdk');
const eventbridge = new AWS.EventBridge();

function putEventInEventBridge(body) {
    var params = {
      Entries: [
        {
          Detail: JSON.stringify(body),
          DetailType: body.eventType,
          Source: body.source
        },
      ]
    };
  
    console.log(params);
    return eventbridge.putEvents(params).promise();
  }

exports.handler = async (event) => {
  console.log('putOrder');
  body = JSON.parse(event.body);
  const data = await putEventInEventBridge(body);

  console.log(data);
  
  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: {}
  }
}