var express = require('express');
var router = express.Router();
var User = require('../database/user');
var { checkAdminRole,
  checkAuth,
  checkAuthReact,
  checkAdminRoleReact,
} = require('../middlewares/checkauth')
var Role = require('../database/role');
var appRoot = require('app-root-path');
var logger = require(`${appRoot}/utils/logger`);
var UserSQL = require('../models/index').User;
const db = require('../models');
var Op = require('../models/index').Sequelize.Op;


function generateAgeRange() {
  var ageFrom = 10;
  var ageTo = 70;
  var ageRange = [];
  for (let i = 0; i <= ageTo - 10; i++) {
    ageRange[i] = ageFrom
    ageFrom++
  }
  return ageRange;
}


router.get('/', checkAuth, checkAdminRole, function (req, res, next) {

  var perPage = 9;
  var page = Number(req.params.page) || 1;

  User.find({})
    .populate('role', 'name -_id')
    .skip((perPage * page) - perPage)
    .limit(perPage)
    .exec(function (err, userslist) {
      if (err) {
        logger.error(err.message);
        return res.status(500).json({ error: true, message: err.message });
      }
      User.count().exec(function (err, count) {
        if (err) {
          logger.error(err.message);
          return res.status(500).json({ error: true, message: err.message });
        }
        return res.render('users', {
          ageRange: generateAgeRange(),
          people: userslist,
          current: page,
          pages: Math.ceil(count / perPage),
          size: 5,
          title: 'Users list page',
          css: ['bootstrap.min.css', 'users.css']
        })
      })
    })
});

async function search(query) {
  var formattedQuery = { where: {}, };
  var perPage = Number(query.perPage) || 9;
  var page = Number(query.page) || 1;
  var nameKey = `%${query.name.trim()}%`;

  formattedQuery.where.fullname = { [Op.iLike]: nameKey };
  formattedQuery.where.age = { [Op.between]: [query.age.min, query.age.max] };
  formattedQuery.offset = ((perPage * page) - perPage);
  formattedQuery.limit = perPage;
  formattedQuery.include = [{model: db.Role}];
  formattedQuery.attributes = {exclude: ['password']};
  formattedQuery.order = [[query.sortTarget, query.sortDirection]];
  
  return UserSQL.findAndCountAll(formattedQuery)
  .then(users => {
    let result = {};
    result.users = users.rows;
    result.current = page;
    result.pages = Math.ceil(users.count/ perPage)

    // console.log(users);
    return result;
  })
  
  // var result = {};
  // const users = await User.find(formattedQuery)
  //   .skip((perPage * page) - perPage)
  //   .limit(perPage)
  //   .sort({[query.sortTarget]: query.sortDirection})
  //   .populate('role', 'name -_id');

  // const count = await User.count(formattedQuery);
  // result.users = users;
  // result.current = page;
  // result.pages = Math.ceil(count / perPage);
  // return result;
}

async function searchOne(id) {
  var query = { 
    where: { 'id': id },
    include: [{model: db.Role}],
    attributes: {exclude: ['password']},
  };
  try {
    var user = await UserSQL.findOne(query)
    return user;
  } catch (err) {
    logger.error(err.message);
    return res.status(500).json({ error: true, message: err.message });
  }

}

router.get(
  '/api/:id', checkAuthReact,
  checkAdminRoleReact,
  async function (req, res, next) {
    var id = req.params.id;
    try {
      const searchResult = await searchOne(id);
      return res.json(searchResult);
    } catch (err) {
      logger.error(err.message);
      return res.status(500).json({ error: true, message: err.message });
    }
  }
)

router.put(
  '/api/:id',
  checkAuthReact,
  checkAdminRoleReact,
  async function (req, res, next) {
    var fieldId = req.body.colId;
    var userId = req.params.id;
    var newValue = req.body.updateValue
    if (fieldId === 'role') {
      return Role.findOne({ _id: newValue })
        .then((role) => {
          User.findOneAndUpdate(
            { _id: userId },
            { role: role._id },
            { new: true }
          )
            .populate('role', 'name -_id')
            .exec(
              function (err, user) {
                if (err) {
                  logger.error(err.message);
                  return res.status(500).json({ error: true, message: err.message });
                }
                return res.json(user.toResponse());
              })
        })
      return res.end();

    }
    User.findOneAndUpdate(
      { _id: userId },
      { [fieldId]: newValue },
      { new: true },
    )
      .populate('role', 'name -_id')
      .exec(
        function (err, user) {
          if (err) {
            logger.error(err.message);
            return res.status(500).json({ error: true, message: err.message });
          }
          return res.json(user.toResponse());
        })



  })

router.get(
  '/api',
  checkAuthReact,
  checkAdminRoleReact,
  async function (req, res, next) {
    var query = req.query;
    try {
      query.age = JSON.parse(req.query.age);
      const result = await search(query);
      return res.json(result);
    } catch (err) {
      logger.error(err.message);
      return res.status(500).json({ error: true, message: err.message });
    }
  }
)

module.exports = router;
