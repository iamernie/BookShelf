const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");

const User = require("../app/models/User"); // Adjust the path to your User model

function initialize(passport) {
  const authenticateUser = async (email, password, done) => {
    // Find user by email
    const user = await User.findOne({ where: { email: email } });
    if (user == null) {
      return done(null, false, { message: "No user with that email" });
    }

    try {
      // Compare password with the hashed password
      if (await bcrypt.compare(password, user.password)) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Password incorrect" });
      }
    } catch (e) {
      return done(e);
    }
  };

  passport.use(new LocalStrategy({ usernameField: "email" }, authenticateUser));
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    User.findByPk(id)
      .then((user) => {
        console.log("Deserialized user:", user); // Log the user object

        done(null, user);
      })
      .catch(done);
  });
}

module.exports = initialize;
