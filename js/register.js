document.getElementById("wholesellerForm").addEventListener("submit", function(e){

  e.preventDefault();

  const formData = new FormData();

  formData.append("wid", document.getElementById("wid").value.trim());
  formData.append("name", document.getElementById("name").value.trim());
  formData.append("location", document.getElementById("location").value.trim());

  fetch("https://script.google.com/macros/s/AKfycbxudcAmn6oSYIc1A7lTeF9Lvai8QYuXkqebhpcocTdfPrDMqIjLvn-BL773sli6OxQokg/exec", {
    method: "POST",
    body: formData
  })
  .then(res => res.text())
  .then(res => {
    alert("Wholeseller Registered Successfully");
    window.location.href = "index.html";
  })
  .catch(err => {
    console.log(err);
    alert("Error registering wholeseller");
  });

});