exports.handler = async (event) => {
  console.log('webhook on salla received');
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json'
    },
    body: `Executed Webhook: Salla \n`
  };
}