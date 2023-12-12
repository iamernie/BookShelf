function filterBooksByStatus() {
  var status = document.querySelector("#statusFilterForm select").value;
  fetch(`/books/filter?status=${encodeURIComponent(status)}`)
    .then((response) => response.text()) // Process as text (HTML)
    .then((html) => {
      // Parse the HTML string to find the book list container
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const newBookList = doc.querySelector("#booksContainer"); // Use the actual ID of your book list container

      if (newBookList) {
        // Replace the current book list container with the new one
        const currentBookList = document.querySelector("#booksContainer");
        if (currentBookList) {
          currentBookList.innerHTML = newBookList.innerHTML;
        } else {
          console.error("Current book list container not found");
        }
      } else {
        console.error("New book list container not found in the response");
      }
    })
    .catch((error) => console.error("Error:", error));
}
