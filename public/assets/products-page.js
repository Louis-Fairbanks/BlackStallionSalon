// Preload product data on window load
let productData;
window.onload = () => {
  let timeoutId = setTimeout(() => {
    const productsContainer = document.querySelector('#products-container');
    const message = document.createElement('h3');
    message.classList.add('text-center', 'mt-5');
    message.id = 'loadingMessage';
    message.textContent = "It seems this site hasn't had many visitors lately and the Render node spun down. Please refresh the page in 1-2 minutes while the node spins back up.";
    productsContainer.appendChild(message);
  }, 2000); 

  fetch('https://blackstallionsalonbackend.onrender.com/products')
    .then(response => response.json())
    .then(data => {
      clearTimeout(timeoutId);  // Clear the timeout if data is loaded within 2 seconds
      const message = document.getElementById('loadingMessage');
      if (message) {
        message.remove();  // Remove the message
      }
      productData = data;
      displayProducts(data);
      loadImages();
    });
};
  
  // Display product cards
  function displayProducts(products) {
    const productsContainer = document.querySelector('#products-container');
    for (const product of products) {
      const col = document.createElement('div');
      col.classList.add('col-12', 'col-sm-6', 'col-md-6', 'col-lg-4');
      const card = document.createElement('div');
      card.classList.add('card');
      col.appendChild(card);
      const cardBody = document.createElement('div');
      cardBody.classList.add('card-body');
      card.appendChild(cardBody);
      const title = document.createElement('h5');
      title.classList.add('card-title');
      title.textContent = product.name;
      cardBody.appendChild(title);
      const description = document.createElement('p');
      description.classList.add('card-text');
      description.textContent = product.description;
      cardBody.appendChild(description);
      const stock = document.createElement('p');
      stock.classList.add('card-text');
      stock.textContent = `Stock: ${product.stock}`;
      cardBody.appendChild(stock);
      productsContainer.appendChild(col);
    }
  }
  
// Load images after initial content is displayed
async function loadImages() {
  const productCards = document.querySelectorAll('.card');
  for (let i = 0; i < productData.length; i++) {
    const product = productData[i];
    if(product.imageUrl){
      console.log(product.imageUrl);
      const image = document.createElement('img');
      image.src = product.imageUrl;
      image.classList.add('card-img-top');
      productCards[i].prepend(image);
    }
  }

  for (let i = 0; i < productData.length; i++) {
    const product = productData[i];
    if (product.image && !product.imageUrl) {
      const imageData = await getImageData(product.image);
      const imageUrl = URL.createObjectURL(imageData);
      const image = document.createElement('img');
      image.src = imageUrl;
      image.classList.add('card-img-top');
      productCards[i].prepend(image);
    }
  }
}
  
  // Get image data
  async function getImageData(imageId) {
    const response = await fetch(`https://blackstallionsalonbackend.onrender.com/products/${imageId}`);
    const blob = await response.blob();
    return blob;
  }