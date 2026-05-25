const params = new URLSearchParams(window.location.search);

const wid = params.get("wid");

document.getElementById("wid").value = wid;

document.getElementById("customerForm").addEventListener("submit", function(e){

    e.preventDefault();

    let data = {
        name: document.getElementById("name").value + " " + document.getElementById("lastname").value,
        phone: document.getElementById("phone").value,
        payment: document.getElementById("payment").value,
        wholeseller_id: wid
    };

    console.log(data);

    fetch("https://script.google.com/macros/s/AKfycbxudcAmn6oSYIc1A7lTeF9Lvai8QYuXkqebhpcocTdfPrDMqIjLvn-BL773sli6OxQokg/exec", {
        method: "POST",
        body: JSON.stringify(data)
    })
    .then(res => res.text())
    .then(response => {
        alert("Saved Successfully");
        console.log(response);
    });

});


