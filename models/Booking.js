const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tour_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tours',
      key: 'id'
    }
  },
  customer_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '고객명'
  },
  customer_phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '연락처'
  },
  customer_email: {
    type: DataTypes.STRING(100),
    comment: '이메일'
  },
  adult_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '성인 수'
  },
  child_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '아동 수'
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 0),
    allowNull: false,
    comment: '총 금액'
  },
  booking_status: {
    type: DataTypes.ENUM('대기', '확정', '취소'),
    defaultValue: '대기',
    comment: '예약 상태'
  },
  special_requests: {
    type: DataTypes.TEXT,
    comment: '특별 요청사항'
  }
}, {
  tableName: 'bookings',
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  comment: '푸른투어 예약'
});

module.exports = Booking;