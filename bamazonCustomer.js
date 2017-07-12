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

        for (var i = 0; i < res.length; i++) {
            itemsPurchased.push(res[i].product_name)
        }

        inquirer.prompt([{
            name: "choices",
            type: "checkbox",
            message: "Use the space bar to enter the item you would like to purchase.",
            choices: itemsPurchased
        }]).then(function(user) {

            if (user.choices.length === 0) {
                console.log("Sorry you didn't select anything!");

                inquirer.prompt([{
                    name: "choice",
                    type: "list",
                    message: "Your shopping cart is empty. Would you like to keep shopping or leave?",
                    choices: ["Keep Shopping", "Leave"]
                }]).then(function(user) {

                    if (user.choice === "Keep Shopping") {
                        productsTable(function() {
                            purchase();
                        });
                    } else {

                        console.log("Thank you for looking.");
                        connection.end();
                    }
                });
            } else {

                howMany(user.choices)
            }
        });
    });
}

function howMany(itemNames) {

    var item = itemNames.shift();
    var itemStock;
    var department;

    connection.query("SELECT quantity, price, department_name FROM Products WHERE ?", {
        product_name: item
    }, function(err, res) {
        if (err) throw err;

        itemStock = res[0].quantity;
        itemCost = res[0].price;
        department = res[0].department_name;
    });

    inquirer.prompt([{
        name: "amount",
        type: "text",
        message: "How many " + item + " would you like to purchase?",

        validate: function(str) {
            if (parseInt(str) <= itemStock) {
                return true
            } else {

                console.log("\nInsufficient quantity! We only have " + itemStock + " of those in stock.");
                return false;
            }
        }
    }]).then(function(user) {
        var amount = user.amount;

        shoppingCart.push({
            item: item,
            amount: amount,
            itemCost: itemCost,
            itemStock: itemStock,
            department: department,
            total: itemCost * amount
        });

        if (itemNames.length != 0) {
            howMany(itemNames);
        } else {

            console.log(shoppingCart);
            checkout();
        }
    });
}

function checkout() {

    if (shoppingCart.length != 0) {
        var grandTotal = 0;

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

        console.log("Total: $" + grandTotal.toFixed(2));
        inquirer.prompt([{
            name: "checkout",
            type: "list",
            message: "Ready to checkout?",
            choices: ["Checkout", "Leave"]
        }]).then(function(res) {
            if (res.checkout === "Checkout") {
                updateDB(grandTotal);
            } else {
                console.log("Ok! Thanks for looking!");
                connection.end();
            }
        });
    } else {
        inquirer.prompt([{
            name: "choice",
            type: "list",
            message: "Your cart is empty. Would you like to keep shopping or leave?",
            choices: ["Keep Shopping", "Leave"]
        }]).then(function(user) {
            if (user.choice === "Keep Shopping") {
                printItems(function() {
                    userSelectsItem();
                });
            } else {

                console.log("Ok! Thanks for looking!");
                connection.end();
            }
        });

    }
}

function updateDB(grandTotal) {
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

        connection.query("UPDATE Products SET ? WHERE ?", [{
                quantity: currentStock -= userPurchase
            },
            {
                product_name: itemName
            }
        ], function(err) {
            if (err) throw err;

            if (shoppingCart.length != 0) {
                updateDB(grandTotal);
            } else {

                grandTotal = grandTotal.toFixed(2);
                console.log("Thank you for your purchase!");
                console.log("Your total today was $" + grandTotal);
                connection.end();
            }
        });
    });
}