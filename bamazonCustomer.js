const mysql = require("mysql");
const inquirer = require("inquirer");
const Table = require("cli-table");
const term = require('terminal-kit').terminal;
const shoppingCart = [];
const totalCost = 0;
const connection = mysql.createConnection({
    host: "localhost",
    port: 3306,

    user: 'root',

    password: 'CA-stle2134',

    database: 'bamazonDB'
});

//-------connection to MySQL---------------
connection.connect(function(err) {
    if (err) throw err;
    console.log("Connected as id " + connection.threadId);


    var sql = "CREATE TABLE IF NOT EXISTS products (id INT NOT NULL AUTO_INCREMENT, product_name VARCHAR(65) NULL, department_name VARCHAR(65) NULL, price DECIMAL(10,2) NULL, quantity INT NULL, PRIMARY KEY (id))";
    connection.query("SELECT * FROM products", function(err, res) {
        if (err) throw err;
        //console.log(res);
    });
});

//-------------Table display--------
function productsTable() {
    connection.query('SELECT * FROM products', function(error, res) {
        let table = new Table({
            head: ['ID', 'Product Name', 'Department Name', 'Price', 'Quantity'],
        });
        for (let i = 0; i < res.length; i++) {
            table.push([res[i].id, res[i].product_name, res[i].department_name, '$' + res[i].price, res[i].quantity])
        }
        console.log(table.toString());
        purchase();
        // connection.end();
    })

}

productsTable();

function purchase() {
    var itemsPurchased = [];
    connection.query("SELECT product_name FROM Products", function(err, res) {
        if (err) throw err;
        //push all product names into the item array
        for (var i = 0; i < res.length; i++) {
            itemsPurchased.push(res[i].product_name)
        }

        inquirer.prompt([{
            name: "choices",
            type: "checkbox",
            message: "Use the space bar to enter the item you would like to purchase.",
            choices: itemsPurchased
        }]).then(function(user) {
            //alert the user if they did not select anything and run function again
            if (user.choices.length === 0) {
                console.log("Sorry you didn't select anything!");
                //if the user doesn't select anything ask if they want to keep shopping or leave
                inquirer.prompt([{
                    name: "choice",
                    type: "list",
                    message: "Your shopping cart is empty. Would you like to keep shopping or leave?",
                    choices: ["Keep Shopping", "Leave"]
                }]).then(function(user) {
                    //if keep shopping is selected print the items and prompt the user to select items again
                    if (user.choice === "Keep Shopping") {
                        productsTable(function() {
                            purchase();
                        });
                    } else {
                        //if leave is selected exit the program
                        console.log("Thank you for looking.");
                        connection.end();
                    }
                });
            } else {
                //run the howManyItems function with all of the items the user selected as an argument
                howMany(user.choices)
            }
        });
    });
}

function howMany(itemNames) {
    //set item equal to the first element of the array and remove that element from the array
    var item = itemNames.shift();
    var itemStock;
    var department;
    //query mysql to get the current stock, price, and department of the item
    connection.query("SELECT quantity, price, department_name FROM Products WHERE ?", {
        product_name: item
    }, function(err, res) {
        if (err) throw err;
        //set stock, price, and department in a variable
        itemStock = res[0].quantity;
        itemCost = res[0].price;
        department = res[0].department_name;
    });
    //prompt the user to ask how many of the item they would like
    inquirer.prompt([{
        name: "amount",
        type: "text",
        message: "How many " + item + " would you like to purchase?",
        //validate that the user input is a number and we have that much of the item in stock
        validate: function(str) {
            if (parseInt(str) <= itemStock) {
                return true
            } else {
                //if we don't have that much in stock alert the user and ask for input again
                console.log("\nInsufficient quantity! We only have " + itemStock + " of those in stock.");
                return false;
            }
        }
    }]).then(function(user) {
        var amount = user.amount;
        //create an object for the item and push it to the shoppingCart
        shoppingCart.push({
            item: item,
            amount: amount,
            itemCost: itemCost,
            itemStock: itemStock,
            department: department,
            total: itemCost * amount
        });
        //if there are still items in the itemNames array run the function again
        if (itemNames.length != 0) {
            howMany(itemNames);
        } else {
            //if no items remain in the itemNames array run the checkout function
            console.log(shoppingCart);
            checkout();
        }
    });
}

function checkout() {
    //ensure there are items in the shoppingCart
    if (shoppingCart.length != 0) {
        var grandTotal = 0;
        //show the user all of the items in their shoppingCart
        console.log("Here is your cart. Are you ready to checkout?");
        for (var i = 0; i < shoppingCart.length; i++) {
            var item = shoppingCart[i].item;
            var amount = shoppingCart[i].amount;
            var cost = shoppingCart[i].itemCost.toFixed(2);
            var total = shoppingCart[i].total.toFixed(2);
            var itemCost = cost * amount;
            grandTotal += itemCost;
            console.log(amount + ' ' + item + ' ' + '$' + total);
        }
        //show the total for the entire cart
        console.log("Total: $" + grandTotal.toFixed(2));
        //prompt the user if they are ready to checkout or need to edit the cart
        inquirer.prompt([{
            name: "checkout",
            type: "list",
            message: "Ready to checkout?",
            choices: ["Checkout", "Leave"]
        }]).then(function(res) {
            //if the user is ready to checkout run the updateDB function to update database
            if (res.checkout === "Checkout") {
                updateDB(grandTotal);
            } else {
                //if leave is selected exit the program
                console.log("Ok! Thanks for looking!");
                connection.end();
            }
        });
    } else {
        //if the shoppingCart is empty alert the user and ask if they want to keep shopping or leave
        inquirer.prompt([{
            name: "choice",
            type: "list",
            message: "Your cart is empty. Would you like to keep shopping or leave?",
            choices: ["Keep Shopping", "Leave"]
        }]).then(function(user) {
            //if keep shopping is selected print the items and prompt the user to select items again
            if (user.choice === "Keep Shopping") {
                printItems(function() {
                    userSelectsItem();
                });
            } else {
                //if leave is selected exit the program
                console.log("Ok! Thanks for looking!");
                connection.end();
            }
        });

    }
}

//function to update the mysql database, takes grandTotal as an argument since it has already been totalled in checkout function
function updateDB(grandTotal) {
    //set the item to the first object in the shoppingCart array and remove that object from the array
    var item = shoppingCart.shift();
    var itemName = item.item;
    var itemCost = item.itemCost
    var userPurchase = item.amount;
    var department = item.department;
    var departmentTransactionSale = itemCost * userPurchase;

    connection.query("SELECT quantity from Products WHERE ?", {
        product_name: itemName
    }, function(err, res) {
        var currentStock = res[0].quantity;
        //update the StockQuantity in the database
        connection.query("UPDATE Products SET ? WHERE ?", [{
                quantity: currentStock -= userPurchase
            },
            {
                product_name: itemName
            }
        ], function(err) {
            if (err) throw err;
            //if there are still items in the shoppingCart run the function again
            if (shoppingCart.length != 0) {
                updateDB(grandTotal);
            } else {
                //if no items remain in the shoppingCart alert the user of the total and exit
                grandTotal = grandTotal.toFixed(2);
                console.log("Thank you for your purchase!");
                console.log("Your total today was $" + grandTotal);
                connection.end();
            }
        });
    });
}