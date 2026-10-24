const cleanEmptyStrings = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      // If it's an empty string, delete it
      if (req.body[key] === '') {
        delete req.body[key];
      }
      // If it's a string with only whitespace, trim or delete
      else if (typeof req.body[key] === 'string' && req.body[key].trim() === '') {
        delete req.body[key];
      }
      // If it's a string, trim it
      else if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

module.exports = cleanEmptyStrings;