import React from 'react';

interface CategorySectionHeaderProps {
  category: string;
  count: number;
}

const CategorySectionHeader: React.FC<CategorySectionHeaderProps> = ({ category, count }) => {
  return (
    <div className="m-category-header flex items-center justify-between">
      <span>{category}</span>
      <span className="text-[10px] font-medium text-muted-foreground/60 normal-case tracking-normal">{count} rooms</span>
    </div>
  );
};

export default CategorySectionHeader;
