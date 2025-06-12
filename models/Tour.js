const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductMaster = sequelize.define('ProductMaster', {
  seq_no: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    field: 'seq_no'
  },
  num: {
    type: DataTypes.INTEGER,
    field: 'num'
  },
  m_dept: {
    type: DataTypes.STRING(100),
    field: 'm_dept',
    comment: '관리부서'
  },
  p_dept: {
    type: DataTypes.STRING(100),
    field: 'p_dept',
    comment: '상품부서'
  },
  m_type: {
    type: DataTypes.CHAR(1),
    defaultValue: 'S',
    field: 'm_type'
  },
  p_type: {
    type: DataTypes.CHAR(1),
    field: 'p_type'
  },
  base_rate: {
    type: DataTypes.CHAR(3),
    defaultValue: 'USD',
    field: 'base_rate'
  },
  p_code: {
    type: DataTypes.STRING(30),
    field: 'p_code',
    comment: '상품코드'
  },
  p_name: {
    type: DataTypes.STRING(300),
    field: 'p_name',
    comment: '상품명'
  },
  p_own: {
    type: DataTypes.STRING(30),
    field: 'p_own',
    comment: '상품 담당자'
  },
  p_day: {
    type: DataTypes.INTEGER,
    field: 'p_day',
    comment: '여행 기간'
  },
  p_cnt: {
    type: DataTypes.INTEGER,
    field: 'p_cnt',
    comment: '정원'
  },
  price_0adult: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'price_0adult',
    comment: '성인 가격'
  },
  price_0child: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'price_0child',
    comment: '아동 가격'
  },
  p_vstart: {
    type: DataTypes.DATE,
    field: 'p_vstart',
    comment: '판매 시작일'
  },
  p_vend: {
    type: DataTypes.DATE,
    field: 'p_vend',
    comment: '판매 종료일'
  },
  t_addr: {
    type: DataTypes.STRING(150),
    field: 't_addr',
    comment: '여행지'
  },
  p_sdesc: {
    type: DataTypes.STRING(150),
    field: 'p_sdesc',
    comment: '상품 요약'
  },
  p_4sdesc: {
    type: DataTypes.TEXT,
    field: 'p_4sdesc',
    comment: '상품 상세설명'
  },
  p_include: {
    type: DataTypes.TEXT,
    field: 'p_include',
    comment: '포함사항'
  },
  p_uninclude: {
    type: DataTypes.TEXT,
    field: 'p_uninclude',
    comment: '불포함사항'
  },
  p_prepare: {
    type: DataTypes.TEXT,
    field: 'p_prepare',
    comment: '준비사항'
  },
  p_display: {
    type: DataTypes.CHAR(1),
    field: 'p_display',
    comment: '표시여부'
  },
  end_yn: {
    type: DataTypes.CHAR(1),
    defaultValue: 'n',
    field: 'end_yn',
    comment: '종료여부'
  },
  sc_grp: {
    type: DataTypes.STRING(20),
    field: 'sc_grp'
  },
  wdate: {
    type: DataTypes.DATE,
    field: 'wdate',
    comment: '등록일'
  }
}, {
  tableName: 'product_master',
  timestamps: false,
  charset: 'utf8',
  collate: 'utf8_general_ci'
});

module.exports = ProductMaster;