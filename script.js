window.addEventListener("scroll", function() {
  const header = document.querySelector(".main-header");
  const titleSection = document.querySelector(".site-title-section");

  // height of logo/title section
  const triggerPoint = titleSection.offsetHeight;

  if (window.scrollY > triggerPoint) {
    header.classList.add("sticky");
  } else {
    header.classList.remove("sticky");
  }
});
