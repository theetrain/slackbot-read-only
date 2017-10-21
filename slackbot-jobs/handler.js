'use strict';

module.exports.slackinstall = (event, context, callback) => {
  const client_id = process.env.SLACK_CLIENT_ID;
  const scopes = 'channels:write,channels:read,channels:history,chat:write:user,chat:write:bot';
  const requestBody = JSON.parse(event.body);
  const response = {
    statusCode: 302,
    headers: {
      Location: 'https://slack.com/oauth/authorize?client_id='+process.env.SLACK_CLIENT_ID+'&scope='+scopes+'&redirect_uri=https://164sgxe0mj.execute-api.us-east-1.amazonaws.com/dev/slack/activate'
    }
  };
  callback(null, response);
}

module.exports.slackactivate = (event, context, callback) => {
  const request = require('request');  
  const body = 'done';
  const AWS = require('aws-sdk');
  const dynamoDb = new AWS.DynamoDB.DocumentClient();
  const response = {
    statusCode: 200,
    body: 'done'
  };
  
  let options = {
    url:'https://slack.com/api/oauth.access',
    form: {
      client_id:process.env.SLACK_CLIENT_ID,
      client_secret:process.env.SLACK_CLIENT_SECRET,
      code:event.queryStringParameters.code
    }
  };
  
  request.post(options, (error, response, body) => {
    let json = JSON.parse(body);
    let params = {
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        access_token: json.access_token
      }
    };
    
    dynamoDb.put(params, (error) => {
      // handle potential errors
      if (error) {
        console.error(error);
        response.statusCode = 501;
        response.body = 'error';
        callback(error, response);
      } else {
        request.post({
          url:'https://slack.com/api/channels.join',
          form: {
            token:json.access_token,
            name:'#general'
          }
        }, (error, response, body) => {
          if(error) {
            console.error(error);
            response.statusCode = 501;
            response.body = 'error';
            callback(error, response);            
          } else {
            console.log(body);
            callback(null, response);
          }
        });
      }
    });
  });
  callback(null, response);
};

module.exports.slackhooks = (event, context, callback) => {
  const AWS = require('aws-sdk');
  const request = require('request');  
  const dynamoDb = new AWS.DynamoDB.DocumentClient();
  const requestBody = JSON.parse(event.body);
  const accessToken = null;
  const response = {
    statusCode: 200
  };
  
  if (requestBody.type == 'url_verification') {
    response.body = requestBody.challenge;
  } else if (requestBody.type == 'event_callback' && requestBody.event.type == 'message') {
    dynamoDb.scan({
      TableName: process.env.DYNAMODB_TABLE,
    }, (error, result) => {
      if(error) {
        console.error(error);
      } else {
        request.post({
          url:'https://slack.com/api/chat.delete',
          form: {
            token:result.Items[0].access_token,
            channel:requestBody['event'].channel,
            ts:requestBody['event'].ts
          }
        })
      }
    })
  }
  callback(null, response);
};

