const express = require('express');
const router = express.Router();

const { body } = require('express-validator');

const Product = require('../models/product');
const Feedback = require('../models/feedback');

const validateRequest = require('../middlewares/validateRequest');
const authenticate = require('../middlewares/authentication');
const authorize = require('../middlewares/authorize');

const transport = require('../helpers/mail');

//Buy product
router.post('/buy/:id', authenticate, authorize('Buyer'), async (req, res) => {
	// Todo: Check Payment Info
	const { payment } = req.body;
	if (!payment) {
		res.status(402).json({ message: 'Failed to buy product' });
	}
	const product = await Product.findById(req.params.id);
	if (!product) return res.status(400).json({ message: 'Product not found' });

	const index = product.buyer.indexOf(req.user._id);
	if (index !== -1)
		return res.status(400).json({ message: 'You already bought this product' });

	product.buyer.push(req.user._id);
	await product.save();

	await transport.sendMail({
		from: process.env.USER,
		to: req.user.email,
		subject: 'Purchase',
		text: 'You Bought this product',
	});

	res.status(201).json({ product, message: 'Product bought successfully' });
});

router.post(
	'/rate/:id',
	validateRequest([
		body('value').exists().withMessage('Value is required'),
		body('text').exists().withMessage('Text is required'),
	]),
	authenticate,
	authorize('Buyer'),
	async (req, res) => {
		const { value, text } = req.body;

		const product = await Product.findById(req.params.id).populate('feedbacks');

		if (!product) return res.status(400).json({ message: 'Product not found' });

		const index = product.buyer.indexOf(req.user._id);
		if (index === -1)
			return res.status(400).json({ message: "You didn't buy this product" });

		const isRated = product.feedbacks.some(
			(feedback) => feedback.user.toString() === req.user._id.toString()
		);
		if (isRated)
			return res
				.status(400)
				.json({ message: 'You already rated this product' });

		const feedback = new Feedback({
			product: product._id,
			user: req.user._id,
			value: value,
			text: text,
		});
		await feedback.save();

		res.status(201).json({ message: 'Product rated successfully', product });
	}
);

router.get('/:id', async (req, res) => {
	const product = await Product.findById(req.params.id).populate('feedbacks');
	res.status(201).json({ product, message: 'Product retrevied successfully' });
});

module.exports = router;