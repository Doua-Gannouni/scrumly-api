const mongoose = require("mongoose");

// Run the operations in a MongoDB transaction : all the changes are saved or none of them
// the documents must be read inside the operations (the transaction can be retried)
// transactions need a replica set (ex: MongoDB Atlas)
const runInTransaction = async (operations) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await operations(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

// Lock a document in a transaction by writing on it :
// two transactions that lock the same document conflict, MongoDB retries the second one
// and it then sees the changes of the first one, so the "read then write" checks stay valid
// (ex: team size, one open increment per sprint, order of the product backlog)
const lockDocument = (Model, id, session) =>
  Model.updateOne({ _id: id }, { $set: { updatedAt: new Date() } }, { session, timestamps: false });

module.exports = { runInTransaction, lockDocument };
