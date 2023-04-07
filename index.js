const express = require('express');
const app = express();
const axios = require('axios');
require("dotenv").config(); 
const PORT = 4000;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); 

const http = require('http').Server(app);
const cors = require('cors');

app.use(cors());
app.use(express.json()) // for json
app.use(express.urlencoded({ extended: true })) // for form data

const socketIO = require('socket.io')(http, {
  cors: {
      origin: "http://localhost:3000"
  }
});

let users = [];
let arr = []
//Add this before the app.get() block
socketIO.on('connection', (socket) => {
  console.log(`: ${socket.id} user just connected!`);
 
  socket.on('userId', (userId) => {
    console.log(`User ${userId} connected`);
    let ids =  arr.map((a) => a.userId)

    arr.push({id: socket.id, userId: userId})
    socketIO.emit('newUserResponse', arr);
    // if (ids.includes(userId)) {

    // } else {
    //   arr.push({id: socket.id, userId: userId})
    //   socketIO.emit('newUserResponse', arr);
    // }
   
  });

   //sends the message to all the users on the server
  socket.on('message', (data) => {
    socketIO.emit('messageResponse', data);
  });

  //sends the message to specific user on the server
  socket.on('sendNotification', (data) => {
    let xx = arr.find((a)=> a.userId === data.recipientId)
    const {  message } = data;
    socketIO.to(xx.id).emit('receiveNotification', message);
  });

  socket.on('sendConferenceNotification', (data) => {
    for (let i=0; i<arr.length; i++) {
      const { message } = data;
      socketIO.to(arr[i].id).emit('receiveNotification', message);
    }
  });

  socket.on('newUser', (data) => {
    users.push(data);
    //Sends the list of users to the client
    socketIO.emit('newUserResponse', users);

    //Adds the new user to the list of users
    // let ids  = users.map((a) => a.socketID)
    // if (ids.includes(data.socketID)) {
    //   socketIO.emit('newUserResponse', users);
    // } else {
    //   users.push(data);
    //   //Sends the list of users to the client
    //   socketIO.emit('newUserResponse', users);
    // }
    
  });

  
  socket.on('disconnect', () => {
    console.log(': A user disconnected');
    //Updates the list of users when a user disconnects from the server
    arr = arr.filter((user) => user.id !== socket.id)
    // console.log(users);
    //Sends the list of users to the client
    socketIO.emit('userLogoutResponse', arr);
 
    socket.disconnect();
  });


});



app.get('/api', (req, res) => {
  res.json({
    message: 'Hello world',
  });
});

// stripe 0047664744

app.post("/api/create-checkout-session", async (req, res) => { 

  const { activityId } = req.body; 
  const customer = await stripe.customers.create({
    metadata: {
      userId: req.body.userId,
      activityId,
      token: req.body.token,
      items: JSON.stringify(req.body.items)
    }
  })

  let line_items = req.body.items.map((product) => {
    return  { 
      price_data: { 
        currency: "usd", 
        product_data: { 
          name: product.name, 
        }, 
        unit_amount: product.price * 100,
      }, 
      quantity: product.qty, 
    }
  })

  const session = await stripe.checkout.sessions.create({ 
    payment_method_types: ["card"], 
    shipping_address_collection: {allowed_countries: ['US', 'CA']},
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: {amount: 0, currency: 'usd'},
          display_name: 'Free shipping',
          delivery_estimate: {
            minimum: {unit: 'business_day', value: 5},
            maximum: {unit: 'business_day', value: 7},
          },
        },
      },
    ],
    phone_number_collection: {
      enabled: true
    },
    customer: customer.id,
    line_items,
    mode: "payment", 
    success_url: `${process.env.CLIENT_URL}/checkout-success`, 
    cancel_url: `${process.env.CLIENT_URL}/activities/${activityId}`, 
  }); 
  // res.json({ id: session.id }); 
  res.send({ url: session.url }); 
}); 


const createOrder = async (customer, data) => {
  console.log(customer);
  await axios.post('http://127.0.0.1:8000/api/create-order', {
    user_id: parseInt(customer.metadata.userId),
    products: [...JSON.parse(customer.metadata.items)],
    total: data.amount_total,
    subtotal: data.amount_subtotal,
    shipping: data.shipping,
    payment_status: data.payment_status,
    delivery_status: data.status,
    activity_id: parseInt(customer.metadata.activityId),
  },
  {
    headers: {
      'Authorization': `Bearer ${customer.metadata.token}`
    }
  })
  .then((res) => {
     console.log(res);
  })
  .catch((e) => console.log(e))
}


// This is your Stripe CLI webhook secret for testing your endpoint locally.
let endpointSecret
// endpointSecret = "whsec_ef0688da5a218462a5f028d6de82a7a503638ec3eea6d9927e81086e5023849a";

app.post('/api/webhook', express.raw({type: 'application/json'}), (req, response) => {
  const sig = req.headers['stripe-signature'];

  let data
  let eventType

  if (endpointSecret) {
    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
      console.log("Webhook verified");
    } catch (err) {
      console.log("Webhook failed");
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    data = event.data.object
    eventType = event.type
  } else {
    data = req.body.data.object
    eventType = req.body.type
  }

  // let cust
  // let dt

  if (eventType === "checkout.session.completed") {
    stripe.customers.retrieve(data.customer).then((customer) => {
      //console.log(customer)
      //console.log("data: ", data)

      createOrder(customer, data)

      
    })
    .catch((err) => console.log(err))
  }


  // Handle the event
 

  // Return a 200 response to acknowledge receipt of the event
  response.send().end();
});

http.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});